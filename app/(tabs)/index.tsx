import {
  StyleSheet,
  TextInput,
  Button,
  View,
  FlatList,
  Text,
} from "react-native";
import { useEffect, useState } from "react";
import EventSource from "react-native-sse";

import { RxDatabase, addRxPlugin, createRxDatabase } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { SafeAreaView } from "react-native-safe-area-context";
addRxPlugin(RxDBDevModePlugin);
import { Subject } from "rxjs";
const myPullStream$ = new Subject();

import { replicateRxCollection } from "rxdb/plugins/replication";

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

type TypeTodo = {
  id: string;
  name: string;
  done: boolean;
  timestamp: string;
};

export default function HomeScreen() {
  const REPLICATION_URL = "https://sort.my.id/rxdb";
  const [db, setDB] = useState<RxDatabase>();
  const [data, setData] = useState({
    id: "yuda - " + Math.random().toString(36).substr(2, 9),
    name: "",
  });
  const [todo, setTodo] = useState<TypeTodo[]>([]);

  function changeHandler(key: string, value: string): void {
    const dataToChange = { ...data, [key]: value };
    setData(dataToChange);
  }

  async function deleteHandler(id: string): Promise<void> {
    const selectedId = db!.todos.find({
      selector: {
        id,
      },
    });
    await selectedId.remove();
    console.log("Deleted ID => ", id);
  }

  async function submitHandler(): Promise<void> {
    // console.log("data to insert", data);
    try {
      const selectedId = await db!.todos
        .findOne({
          selector: {
            id: data.id,
          },
        })
        .exec();
      console.log(data);
      console.log(selectedId);

      if (selectedId) {
        await selectedId.patch({ name: data.name });
        console.log("Updated ID => ", data.id);
      } else {
        console.log("Inserted ID => ", data.id);
        await db?.todos.insert({
          ...data,
          timestamp: new Date().toISOString(),
          done: false,
        });
      }

      setTimeout(() => {
        setData({
          id: "yuda - " + Math.random().toString(36).substr(2, 9),
          name: "",
        });
      }, 1000);
    } catch (err) {
      console.log("Error inserting data", err);
    }
  }

  async function dbInitiation(): Promise<void> {
    if (!db) {
      const dbConnection = await createRxDatabase({
        name: "/myDatabase",
        storage: getRxStorageMemory(),
        multiInstance: false,
        //plugins: [RxDBDevModePlugin]
      });

      await dbConnection.addCollections({
        todos: { schema: todoSchema },
      });
      setDB(dbConnection);
    }
  }

  async function replicationHandler(): Promise<void> {
    const eventSource = new EventSource(`${REPLICATION_URL}/stream`);
    eventSource.addEventListener("message", (event) => {
      const eventData = JSON.parse(event.data || "{}");
      myPullStream$.next({
        documents: eventData.documents,
        checkpoint: eventData.checkpoint,
      });
    });
    eventSource.addEventListener("error", () => myPullStream$.next("RESYNC"));

    replicateRxCollection({
      collection: db!.todos,
      replicationIdentifier: "my-http-replication",
      push: {
        async handler(changeRows) {
          const rawResponse = await fetch(REPLICATION_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(changeRows),
          });
          const conflictsArray = await rawResponse.json();
          return conflictsArray;
        },
      },
      pull: {
        stream$: myPullStream$.asObservable(),
        async handler() {
          //const updatedAt = checkpointOrNull ? checkpointOrNull.updatedAt : 0;
          //const id = checkpointOrNull ? checkpointOrNull.id : "";
          const response = await fetch(
            // `${REPLICATION_URL}?updatedAt=${updatedAt}&id=${id}&limit=${batchSize}`,
            REPLICATION_URL,
          );
          const data = await response.json();
          // console.log("pull response: ", data);
          return {
            documents: data.documents,
            checkpoint: data.checkpoint,
          };
        },
      },
    });
  }

  async function readDB(): Promise<void> {
    const todoData = await db!.todos.find({}).exec();
    // console.log("initiate read => ", todoData);
    setTodo(todoData);
  }

  async function subscribeTodo(): Promise<void> {
    const todoData = db!.todos.find({}).$;
    todoData.subscribe((todoData: TypeTodo[]) => {
      // console.log("todoData", todoData);
      setTodo(todoData);
    });
  }

  useEffect(() => {
    dbInitiation().catch((err) => console.log(err));
  }, []);

  useEffect(() => {
    if (db) {
      // console.log("onDBchanges =============");
      subscribeTodo()
        .then(() => readDB())
        .then(() => replicationHandler())
        .catch((err) => console.log("subscribe issue ", err));
    }
  }, [db]);

  const ItemsComponent = ({ item }: { item: TypeTodo }) => {
    return (
      <View style={styles.listItem}>
        <View style={{}}>
          <Button
            title="remove"
            color="red"
            onPress={() => deleteHandler(item.id)}
          />
        </View>
        <View style={{ marginLeft: 5 }}>
          <Button
            title="edit"
            color="green"
            onPress={() => setData({ id: item.id, name: item.name })}
          />
        </View>
        <Text style={{ paddingHorizontal: 5 }}>{item.id}</Text>
        <Text style={{ paddingHorizontal: 5 }}>{item.name}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.titleContainer}>
      <TextInput
        placeholder="id"
        value={data.id}
        style={{
          padding: 5,
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "gray",
        }}
        readOnly={true}
        onChangeText={(text: string) => changeHandler("id", text)}
      />
      <TextInput
        placeholder="name"
        value={data.name}
        style={{
          marginTop: 5,
          padding: 5,
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "gray",
        }}
        onChangeText={(text: string) => changeHandler("name", text)}
      />
      <View
        style={{
          marginTop: 20,
        }}
      >
        <Button title="Submit" onPress={submitHandler} />
      </View>
      <View
        style={{
          marginTop: 20,
        }}
      >
        <Button
          title="Refresh"
          onPress={() => {
            readDB();
          }}
        />
      </View>
      <View style={{ marginTop: 20 }}>
        <FlatList
          data={todo}
          renderItem={({ item }) => <ItemsComponent item={item} />}
          keyExtractor={(item) => item.id}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    marginTop: 20,
    padding: 10,
  },
  listItem: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "yellow",
    padding: 5,
    marginVertical: 5,
  },
});
