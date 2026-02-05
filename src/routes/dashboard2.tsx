import { useSuspenseQuery } from "@tanstack/react-query";
import {createRoute, useLoaderData} from "@tanstack/react-router";
import {Card, Col, Row, Statistic, Table, Typography, Flex, Space, Select, DatePicker} from "antd";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
// import the Leaflet CSS to ensure the map styles render correctly.
import "leaflet/dist/leaflet.css";
import { signalsQueryOptions, smsQueryOptions } from "../collections";
import dayjs from "dayjs";
import React, {useMemo, useState, useEffect} from "react";
import { RootRoute } from "./__root";

// Dashboard2 route definition
export const Dashboard2Route = createRoute({
    getParentRoute: () => RootRoute,
    path: "/dashboard2",
    component: Dashboard2Component,
    loader: (opts) => {
        // Preload SMS and signal data with a large page size for aggregations
        const smsPromise = opts.context.queryClient.ensureQueryData(
            smsQueryOptions(opts.context.engine),
        );
        const signalsPromise = opts.context.queryClient.ensureQueryData(
            signalsQueryOptions(opts.context.engine, {
                filters: {},
                pagination: { current: 1, pageSize: 500 },
            }),
        );
        return Promise.all([smsPromise, signalsPromise]);
    },
});

/**
 * Dashboard2Component displays enhanced statistics derived from SMS and signal events.
 *
 * It aggregates counts for different stages of the signal lifecycle (triage, verification,
 * assessment) and summarizes risk levels and district distribution.
 */
function Dashboard2Component() {
    // Access the engine via the route context
    const { engine } = Dashboard2Route.useRouteContext();
    // Query inbound SMS messages
    const { data: smsData } = useSuspenseQuery(smsQueryOptions(engine));
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [selectedOrgUnit, setSelectedOrgUnit] = useState<string | null>(null);
    // Query all signal events with a large page size
    const { data: signalsData } = useSuspenseQuery(
        signalsQueryOptions(engine, {
            filters: {},
            pagination: { current: 1, pageSize: 500 },
            startDate:
                dateRange && dateRange[0]
                    ? dateRange[0].startOf("day").format("YYYY-MM-DD")
                    : undefined,
            endDate:
                dateRange && dateRange[1]
                    ? dateRange[1].endOf("day").format("YYYY-MM-DD")
                    : undefined,
            orgUnit: selectedOrgUnit || undefined,
        } as any),
    );

    const { assignedDistricts, districtGeojson } = useLoaderData({ from: "__root__" });

    // Aggregate SMS counts
    const totalSMS = smsData.pager.total;
    const forwardedSMS = smsData.inboundsmss.filter((s) => s.forwarded).length;
    const pendingSMS = smsData.inboundsmss.filter((s) => !s.forwarded).length;

    // Aggregate signal counts by workflow stages
    const triagedEvents = signalsData.events.filter(
        (event) => event.dataValues["RZMTtSyhdHY"],
    );
    const triagedRelevant = triagedEvents.filter(
        (event) => event.dataValues["RZMTtSyhdHY"] === "Relevant",
    ).length;
    const triagedDiscard = triagedEvents.filter(
        (event) => event.dataValues["RZMTtSyhdHY"] === "Discard",
    ).length;

    const verifiedEvents = signalsData.events.filter(
        (event) => event.dataValues["FidiishnZJZ"],
    );
    const verifiedAlert = verifiedEvents.filter(
        (event) => event.dataValues["FidiishnZJZ"] === "Alert",
    ).length;
    const verifiedDiscard = verifiedEvents.filter(
        (event) => event.dataValues["FidiishnZJZ"] === "Discard",
    ).length;

    const assessedEvents = signalsData.events.filter(
        (event) => event.dataValues["VaO1WnueBpu"],
    );
    const assessedCount = assessedEvents.length;

    // Compute the number of unassessed signals (events that lack a risk assessment).  This
    // helps populate the Assessment summary card.  Unassessed signals are those
    // without a value for the risk assessment data element.
    const unassessedCount = signalsData.events.length - assessedCount;

    // Compute the number of unique (non-duplicate) signals.  Duplicate signals are
    // flagged via the data element LxWNKdd93lq.  We subtract duplicates from the
    // total number of signals to obtain unique signals for the duplicates summary.

    const duplicateCount = signalsData.events.filter(
        (event) => event.dataValues["LxWNKdd93lq"] === "Yes",
    ).length;

    const uniqueSignalsCount = signalsData.events.length - duplicateCount;

    // Count risk levels across assessed events
    const riskCounts = signalsData.events.reduce((acc: Record<string, number>, event) => {
        const riskLevel = event.dataValues["x84ZTtD0Z8u"] || "Unknown";
        acc[riskLevel] = (acc[riskLevel] || 0) + 1;
        return acc;
    }, {});

    /**
     * Group signals by district ID. We derive the district identifier from
     * either the event's `dataValues["district"]` (set when an SMS is
     * forwarded) or the event's `orgUnit` field.  This yields a map of
     * district IDs to signal counts.  Using IDs avoids name mismatches when
     * matching with GeoJSON features and the assigned districts list.
     */
    const signalCountsByDistrict = useMemo(() => {
        const counts: Record<string, number> = {};
        signalsData.events.forEach((event) => {
            // Prefer the stored district ID in dataValues; fall back to orgUnit
            const districtId =
                (event.dataValues && (event.dataValues as any)["district"]) ||
                (event as any).orgUnit;
            if (!districtId) return;
            counts[districtId] = (counts[districtId] || 0) + 1;
        });
        return counts;
    }, [signalsData.events]);

    // Create the district breakdown table using the assignedDistricts list.  This
    // ensures every district is represented, even if it has zero signals.  We
    // sort descending by the number of signals.
    const districtData = useMemo(() => {
        const rows = (assignedDistricts || []).map(({ label, value }) => ({
            key: value,
            district: label,
            signals: signalCountsByDistrict[value] || 0,
        }));
        return rows.sort((a, b) => b.signals - a.signals);
    }, [assignedDistricts, signalCountsByDistrict]);

    // Determine the maximum signal count across all districts for colour scaling.
    const maxDistrictCount = useMemo(() => {
        const values = Object.values(signalCountsByDistrict);
        return values.length > 0 ? Math.max(...(values as number[])) : 0;
    }, [signalCountsByDistrict]);

    // Compute a color for a district based on its signal count.  We scale the
    // hue from green (no signals) to red (max signals) using the HSL color
    // space.  If there are no signals in any district, return a neutral gray.
    const getDistrictColor = (count: number): string => {
        // When there are no signals at all, use a neutral grey colour.
        if (!maxDistrictCount || maxDistrictCount === 0) {
            return "#d9d9d9";
        }
        const ratio = count / maxDistrictCount;
        const hue = 120 - ratio * 120; // 120 = green, 0 = red
        return `hsl(${hue}, 60%, 50%)`;
    };

    // Style function for each GeoJSON feature.  It uses the feature ID to
    // retrieve the signal count from signalCountsByDistrict.  If the feature
    // has no signals, the colour will be neutral grey.  The border is white.
    const geoStyle = (feature: any) => {
        const id = feature.id || feature.properties?.id;
        const count = signalCountsByDistrict[id] || 0;
        return {
            fillColor: getDistrictColor(count),
            weight: 1,
            opacity: 1,
            color: "#ffffff",
            dashArray: "3",
            fillOpacity: 0.7,
        };
    };

    // Bind a popup to each district polygon showing its name and signal count.
    const onEachDistrictFeature = (feature: any, layer: any) => {
        const id = feature.id || feature.properties?.id;
        const name = feature.properties?.name || feature.properties?.na || feature.properties?.displayName || id;
        const count = signalCountsByDistrict[id] || 0;
        layer.bindPopup(`${name}: ${count} signal${count !== 1 ? "s" : ""}`);
    };

    // Prepare data for the status breakdown table
    const statusRows = [
        { key: "triagedRelevant", stage: "Triaged (Relevant)", count: triagedRelevant },
        { key: "triagedDiscard", stage: "Triaged (Discard)", count: triagedDiscard },
        { key: "verifiedAlert", stage: "Verified (Alert)", count: verifiedAlert },
        { key: "verifiedDiscard", stage: "Verified (Discard)", count: verifiedDiscard },
        { key: "assessed", stage: "Assessed", count: assessedCount },
        { key: "duplicates", stage: "Duplicates", count: duplicateCount },
    ];
    const statusColumns = [
        { title: "Stage", dataIndex: "stage", key: "stage" },
        { title: "Count", dataIndex: "count", key: "count" },
    ];

    // Prepare data for the district breakdown table
    const districtColumns = [
        { title: "District", dataIndex: "district", key: "district" },
        { title: "Signals", dataIndex: "signals", key: "signals" },
    ];

    /**
     * Keyword analysis: build a word cloud from inbound SMS messages while
     * excluding common stop words and domain‑specific terms like "alert".
     */
    // A set of stop words to ignore. These words are compared in lowercase.
    const stopWords = useMemo(() =>
        new Set([
            "alert",
            "the",
            "and",
            "a",
            "an",
            "to",
            "of",
            "in",
            "on",
            "for",
            "with",
            "is",
            "are",
            "was",
            "were",
            "be",
            "this",
            "that",
            "it",
            "you",
            "your",
            "at",
            "from",
            "by",
            "or",
            "as",
            "we",
            "i",
            "not",
            "but",
            "about",
            "have",
            "has",
            "had",
            "our",
            "us",
            "mtn",
            "airtel",
            "yrs",
            "id",
        ]),
        [],
    );

    // Compute word frequency and assign a size and colour to each word.  The
    // resulting array contains the top 30 words sorted by count.
    const wordCloudEntries = useMemo(() => {
        const counts: Record<string, number> = {};
        smsData?.inboundsmss?.forEach((sms: any) => {
            const text: string = sms.text || sms.message || "";
            text.split(/\s+/).forEach((rawWord) => {
                // Clean the word: keep only alphanumeric characters, then remove digits
                const cleaned = rawWord
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "");
                // Remove all numbers so we don't include numeric codes or values
                const wordOnly = cleaned.replace(/[0-9]/g, "");
                if (!wordOnly) return;
                if (stopWords.has(wordOnly)) return;
                counts[wordOnly] = (counts[wordOnly] || 0) + 1;
            });
        });
        const entries = Object.entries(counts);
        entries.sort((a, b) => b[1] - a[1]);
        const top = entries.slice(0, 30);
        const maxCount = top.length > 0 ? top[0][1] : 1;
        const palette = [
            "#5b8ff9",
            "#61d9a0",
            "#f7ba2a",
            "#e87a90",
            "#ff7f50",
            "#b37feb",
            "#36cfc9",
            "#ffa940",
            "#73d13d",
            "#40a9ff",
        ];
        return top.map(([word, count], idx) => {
            const size = 14 + (count / maxCount) * 26;
            const color = palette[idx % palette.length];
            return { word, count, size, color };
        });
    }, [smsData, stopWords]);

    /**
     * Risk distribution and timeline charts.  We compute the number of signals
     * for each risk level and the number of signals per day over the last 10
     * days to visualise trends.
     */
    const totalSignalsCount = signalsData.events.length || 1;
    const riskLevels = ["Low", "Moderate", "High", "Very High", "Unknown"];
    const riskColors: Record<string, string> = {
        Low: "#52c41a",
        Moderate: "#faad14",
        High: "#f5222d",
        "Very High": "#cf1322",
        Unknown: "#d9d9d9",
    };
    const riskSegments = riskLevels.map((level) => {
        const count = riskCounts[level] || 0;
        return {
            level,
            count,
            percent: totalSignalsCount > 0 ? (count / totalSignalsCount) * 100 : 0,
        };
    });
    // Compute timeline data using useMemo to avoid recomputation.  We always
    // display the last 10 days (or the end of the selected date range) and
    // include days with zero signals.  If no events exist, we default to the
    // current date as the end date.
    const timelineData = useMemo(() => {
        const counts: Record<string, number> = {};
        // Aggregate counts by date (YYYY-MM-DD).  Use eventDate when
        // available; fall back to lastUpdated.
        signalsData.events.forEach((event) => {
            const rawDate: string | undefined =
                (event as any).eventDate || (event as any).lastUpdated;
            if (!rawDate) return;
            const dateKey = rawDate.slice(0, 10);
            if (!dateKey) return;
            counts[dateKey] = (counts[dateKey] || 0) + 1;
        });
        // Determine the end date for the timeline.  Prefer the end of the date
        // range selected by the user; otherwise use the latest date among
        // events; if none, use today.
        let endDate: dayjs.Dayjs;
        if (dateRange && dateRange[1]) {
            endDate = dateRange[1].endOf("day");
        } else {
            const sortedKeys = Object.keys(counts).sort();
            if (sortedKeys.length > 0) {
                endDate = dayjs(sortedKeys[sortedKeys.length - 1]);
            } else {
                endDate = dayjs();
            }
        }
        // Build 10 sequential dates ending at endDate.  We build from oldest
        // to newest to match the display order.  Also compute the maximum
        // count to normalise bar heights.
        const timeline: { date: string; count: number }[] = [];
        let maxCount = 0;
        for (let i = 9; i >= 0; i--) {
            const d = endDate.subtract(9 - i, "day");
            const key = d.format("YYYY-MM-DD");
            const count = counts[key] || 0;
            timeline.push({ date: key, count });
            if (count > maxCount) maxCount = count;
        }
        // Map to chart items with height scaled to maxCount.  When maxCount is
        // zero, all heights remain zero.
        return timeline.map(({ date, count }) => ({
            date,
            count,
            height: maxCount > 0 ? (count / maxCount) * 60 : 0,
        }));
    }, [signalsData.events, dateRange]);

    // Generate a key for the map container.  Changing this key forces
    // React‑Leaflet to unmount and recreate the map, which prevents the
    // "Map container is already initialized" error when filters change.
    const mapKey = useMemo(() => {
        const parts: string[] = [];
        if (selectedOrgUnit) parts.push(selectedOrgUnit);
        if (dateRange) {
            if (dateRange[0]) parts.push(dateRange[0].format("YYYY-MM-DD"));
            if (dateRange[1]) parts.push(dateRange[1].format("YYYY-MM-DD"));
        }
        return parts.join("-") || "default";
    }, [selectedOrgUnit, dateRange]);

    return (
        <Flex
            vertical
            gap={24}
            style={{ height: "100%", overflow: "auto", padding: 8 }}
        >
            <Typography.Title
                level={2}
                style={{ margin: 0, fontWeight: 700 }}
            >
                Dashboard
            </Typography.Title>
            <Row gutter={[16, 16]}>
                <Col>
                    <DatePicker.RangePicker
                        value={dateRange}
                        onChange={(values) => setDateRange(values as any)}
                        allowClear
                    />
                </Col>
                <Col>
                    <Select
                        style={{ width: 200 }}
                        allowClear
                        placeholder="Filter by district"
                        options={assignedDistricts}
                        value={selectedOrgUnit}
                        onChange={(value) => setSelectedOrgUnit(value)}
                    />
                </Col>
            </Row>

            {/* Summary cards row with six metrics */}
            <Row gutter={[24, 24]}>
                {/* Total SMS card */}
                <Col xs={24} sm={12} lg={4} style={{ display: "flex" }}>
                    <Card
                        variant="borderless"
                        style={{
                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)",
                            flex: 1,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <Statistic
                                title={
                                    <span
                                        style={{ color: "rgba(255,255,255,0.95)", fontSize: 16, fontWeight: 500 }}
                                    >
                                        Total SMS
                                    </span>
                                }
                                value={totalSMS}
                                valueStyle={{ color: "white", fontSize: 32, fontWeight: 700 }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Forwarded</span>
                                }
                                value={forwardedSMS}
                                valueStyle={{ color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Pending</span>
                                }
                                value={pendingSMS}
                                valueStyle={{ color: "white" }}
                            />
                        </Space>
                    </Card>
                </Col>
                {/* Total Signals card */}
                <Col xs={24} sm={12} lg={4} style={{ display: "flex" }}>
                    <Card
                        variant="borderless"
                        style={{
                            background: "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)",
                            boxShadow: "0 8px 24px rgba(255, 154, 158, 0.4)",
                            flex: 1,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <Statistic
                                title={
                                    <span
                                        style={{ color: "rgba(255,255,255,0.95)", fontSize: 16, fontWeight: 500 }}
                                    >
                                        Total Signals
                                    </span>
                                }
                                value={signalsData.events.length}
                                valueStyle={{ color: "white", fontSize: 32, fontWeight: 700 }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Triaged</span>
                                }
                                value={triagedEvents.length}
                                valueStyle={{ color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Verified</span>
                                }
                                value={verifiedEvents.length}
                                valueStyle={{ color: "white" }}
                            />
                        </Space>
                    </Card>
                </Col>
                {/* Triaged card */}
                <Col xs={24} sm={12} lg={4} style={{ display: "flex" }}>
                    <Card
                        variant="borderless"
                        style={{
                            background: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
                            boxShadow: "0 8px 24px rgba(161, 196, 253, 0.4)",
                            flex: 1,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 16, fontWeight: 500 }}>Triaged</span>
                                }
                                value={triagedEvents.length}
                                valueStyle={{ color: "white", fontSize: 32, fontWeight: 700 }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Relevant</span>
                                }
                                value={triagedRelevant}
                                valueStyle={{ color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Discard</span>
                                }
                                value={triagedDiscard}
                                valueStyle={{ color: "white" }}
                            />
                        </Space>
                    </Card>
                </Col>
                {/* Verified card */}
                <Col xs={24} sm={12} lg={4} style={{ display: "flex" }}>
                    <Card
                        variant="borderless"
                        style={{
                            background: "linear-gradient(135deg, #f5d395 0%, #f38c5f 100%)",
                            boxShadow: "0 8px 24px rgba(243, 140, 95, 0.4)",
                            flex: 1,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 16, fontWeight: 500 }}>Verified</span>
                                }
                                value={verifiedEvents.length}
                                valueStyle={{ color: "white", fontSize: 32, fontWeight: 700 }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Alert</span>
                                }
                                value={verifiedAlert}
                                valueStyle={{ color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Discard</span>
                                }
                                value={verifiedDiscard}
                                valueStyle={{ color: "white" }}
                            />
                        </Space>
                    </Card>
                </Col>
                {/* Assessment card */}
                <Col xs={24} sm={12} lg={4} style={{ display: "flex" }}>
                    <Card
                        variant="borderless"
                        style={{
                            background: "linear-gradient(135deg, #96e6a1 0%, #d4fc79 100%)",
                            boxShadow: "0 8px 24px rgba(150, 230, 161, 0.4)",
                            flex: 1,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 16, fontWeight: 500 }}>Assessment</span>
                                }
                                value={assessedCount}
                                valueStyle={{ color: "white", fontSize: 32, fontWeight: 700 }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Assessed</span>
                                }
                                value={assessedCount}
                                valueStyle={{ color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Unassessed</span>
                                }
                                value={unassessedCount}
                                valueStyle={{ color: "white" }}
                            />
                        </Space>
                    </Card>
                </Col>
                {/* Duplicates card */}
                <Col xs={24} sm={12} lg={4} style={{ display: "flex" }}>
                    <Card
                        variant="borderless"
                        style={{
                            background: "linear-gradient(135deg, #ffa69e 0%, #861657 100%)",
                            boxShadow: "0 8px 24px rgba(255, 166, 158, 0.4)",
                            flex: 1,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 16, fontWeight: 500 }}>Duplicates</span>
                                }
                                value={duplicateCount}
                                valueStyle={{ color: "white", fontSize: 32, fontWeight: 700 }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Duplicate</span>
                                }
                                value={duplicateCount}
                                valueStyle={{ color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14 }}>Unique</span>
                                }
                                value={uniqueSignalsCount}
                                valueStyle={{ color: "white" }}
                            />
                        </Space>
                    </Card>
                </Col>
            </Row>
            {/* Charts row: risk distribution and signals over time */}
            <Row gutter={[24, 24]}>
                <Col xs={24} lg={12} style={{ display: "flex" }}>
                    <Card title="Risk Distribution" variant="borderless" style={{ flex: 1 }}>
                        {/* Horizontal stacked bar representing risk distribution */}
                        <div
                            style={{
                                display: "flex",
                                height: 24,
                                borderRadius: 4,
                                overflow: "hidden",
                                marginBottom: 8,
                            }}
                        >
                            {riskSegments.map((seg) => (
                                <div
                                    key={seg.level}
                                    style={{
                                        width: `${seg.percent}%`,
                                        background: riskColors[seg.level],
                                    }}
                                />
                            ))}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {riskSegments.map((seg) => (
                                <div
                                    key={seg.level}
                                    style={{ fontSize: 12, display: "flex", alignItems: "center" }}
                                >
                                    <span
                                        style={{
                                            display: "inline-block",
                                            width: 10,
                                            height: 10,
                                            background: riskColors[seg.level],
                                            borderRadius: 2,
                                            marginRight: 4,
                                        }}
                                    ></span>
                                    {seg.level} ({seg.count})
                                </div>
                            ))}
                        </div>
                    </Card>
                </Col>
                <Col xs={24} lg={12} style={{ display: "flex" }}>
                    <Card title="Signals Over Time" variant="borderless" style={{ flex: 1 }}>
                        {/* Simple bar chart showing the count of signals per day for the last 10 days */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-end",
                                height: 100,
                                width: "100%",
                            }}
                        >
                            {timelineData.map(({ date, height, count }) => (
                                <div
                                    key={date}
                                    style={{
                                        flex: 1,
                                        margin: "0 2px",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "100%",
                                            height: `${height}px`,
                                            background: "#69c0ff",
                                            borderRadius: 2,
                                        }}
                                    ></div>
                                    <div style={{ fontSize: 10, marginTop: 4 }}>
                                        {dayjs(date).format("MM-DD")}
                                    </div>
                                    <div style={{ fontSize: 9, color: "#888" }}>{count}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Status and district breakdown tables */}
            <Row gutter={[24, 24]}>
                <Col xs={24} lg={12} style={{ display: "flex" }}>
                    <Card title="Status Breakdown" variant="borderless" style={{ flex: 1 }}>
                        <Table
                            columns={statusColumns}
                            dataSource={statusRows}
                            pagination={false}
                            rowKey="stage"
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={12} style={{ display: "flex" }}>
                    <Card title="Signals by District" variant="borderless" style={{ flex: 1 }}>
                        <Table
                            columns={districtColumns}
                            dataSource={districtData}
                            pagination={false}
                            rowKey="district"
                            scroll={{ y: 290 }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Map and Keyword Cloud row: display the choropleth map and word cloud side by side */}
            <Row gutter={[24, 24]}>
                {/* Map column */}
                <Col xs={24} lg={12} style={{ display: "flex" }}>
                    <Card title="Signal Density Map" variant="borderless" style={{ flex: 1 }}>
                        {districtGeojson.features ? (
                            <MapContainer
                                key={mapKey}
                                center={[1.3733, 32.2903]}
                                zoom={6}
                                style={{ height: "400px", width: "100%" }}
                                scrollWheelZoom={false}
                            >
                                {/* Base map tiles from OpenStreetMap.  You can configure another tile provider if desired. */}
                                <TileLayer
                                    attribution=
                                        "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <GeoJSON
                                    data={districtGeojson.features as any}
                                    style={geoStyle}
                                    onEachFeature={onEachDistrictFeature}
                                />
                            </MapContainer>
                        ) : (
                            <div>Loading map data…</div>
                        )}
                    </Card>
                </Col>
                {/* Keyword Cloud column */}
                <Col xs={24} lg={12} style={{ display: "flex" }}>
                    <Card title="Keyword Cloud" variant="borderless" style={{ flex: 1 }}>
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                alignItems: "flex-end",
                            }}
                        >
                            {wordCloudEntries.map(({ word, size, color }) => (
                                <span
                                    key={word}
                                    style={{
                                        fontSize: `${size}px`,
                                        color,
                                        fontWeight: 500,
                                        lineHeight: 1,
                                    }}
                                >
                                    {word}
                                </span>
                            ))}
                        </div>
                    </Card>
                </Col>
            </Row>
        </Flex>
    );
}
