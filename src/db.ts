import Dexie, { Table } from "dexie";
import { EventWithValues } from "./types";

class SignalDB extends Dexie {
    events!: Table<EventWithValues, string>;
    constructor() {
        super("SignalDB");
        this.version(1).stores({
            events: "event,lastUpdated",
        });
    }
}

export const db = new SignalDB();
