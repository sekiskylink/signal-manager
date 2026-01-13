/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: "app",
    description: "Signal Manager",
    title: "Signal Manager",
    name: "signal-manager",
    entryPoints: {
        app: "./src/App.tsx",
    },
};

module.exports = config;
