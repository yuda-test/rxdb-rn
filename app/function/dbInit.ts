import { RxDatabase, createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";

const todoSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    _deleted: {
      type: "boolean",
    },
    id: {
      type: "string",
      maxLength: 100, // <- the primary key must have set maxLength
    },
    name: {
      type: "string",
    },
    done: {
      type: "boolean",
    },
    timestamp: {
      type: "string",
      format: "date-time",
    },
  },
  required: ["id", "name", "done", "timestamp"],
};

async function dbInitiation(db: RxDatabase): Promise<RxDatabase> {
  if (!db) {
    const dbConnection = await createRxDatabase({
      name: "/myDatabase",
      storage: getRxStorageMemory(),
      multiInstance: false,
    });

    await dbConnection.addCollections({
      todos: { schema: todoSchema },
    });

    return dbConnection;
  }

  return db;
}

export default dbInitiation;
