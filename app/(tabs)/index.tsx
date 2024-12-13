import {
  StyleSheet,
  TextInput,
  Button,
  View,
  FlatList,
  Text,
} from "react-native";
import React, { useEffect, useState } from "react";
import EventSource from "react-native-sse";

import {
  MaybePromise,
  ReplicationPushHandlerResult,
  RxDatabase,
  RxReplicationPullStreamItem,
  addRxPlugin,
  createRxDatabase,
} from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { SafeAreaView } from "react-native-safe-area-context";

import { RxReplicationState } from "rxdb/plugins/replication";
import {
  replicateGraphQL,
  RxGraphQLReplicationState,
} from "rxdb/plugins/replication-graphql";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";

const authToken =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Il9pZCI6IjY1ZDZiYTg4ZGMzM2MyOTFmNWY5YzU3YiIsImxpY2Vuc2UiOiI2NWQ2YmE4YWRjMzNjMjkxZjVmOWM3MGUiLCJuYW1lIjoiZmFuZGkifSwiaWF0IjoxNzMzNzU3NjA3LCJleHAiOjE3NjQ4NjE2MDd9.RQ0DjwNsgtpIRBQCav9LxFe7UPNJNAltL4J_CFBJ7fQ";

Amplify.configure({
  API: {
    GraphQL: {
      region: "eu-central-1",
      endpoint:
        "https://dyewzulquzabraucc4urj7yv24.appsync-api.eu-central-1.amazonaws.com/graphql",
      defaultAuthMode: "lambda",

      // endpoint: "https://uwxwtxbufrg5xdhlccqvdl7fze.appsync-api.eu-central-1.amazonaws.com/graphql",
      // defaultAuthMode: 'apiKey',
      // apiKey: "da2-tq2f72s5bvc4bf4u3teusys6aa"
    },
  },
});

const client = generateClient({
  authMode: "lambda",
  authToken,
});

addRxPlugin(RxDBDevModePlugin);

import { Subject } from "rxjs";
import { replicateRxCollection } from "rxdb/plugins/replication";

const myPullStream$ = new Subject<
  RxReplicationPullStreamItem<unknown, unknown>
>();

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

type CheckPoint = {
  id: string;
  updatedAt: number;
};

const Bearer =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Il9pZCI6IjY1ZDZiYTg4ZGMzM2MyOTFmNWY5YzU3YiIsImxpY2Vuc2UiOiI2NWQ2YmE4YWRjMzNjMjkxZjVmOWM3MGUiLCJuYW1lIjoiZmFuZGkifSwiaWF0IjoxNzMyODU0NTAzLCJleHAiOjE3NjM5NTg1MDN9.BRp9va4zrIl1QxlWCH4iVSkFF19fMFD_yDjcIcjDZoo";

export default function HomeScreen() {
  const REPLICATION_URL = "https://sort.my.id/rxdb";
  const [db, setDB] = useState<RxDatabase>();
  const [data, setData] = useState({
    id: "yuda - " + Math.random().toString(36).substr(2, 9),
    name: "",
  });
  const [todo, setTodo] = useState<TypeTodo[]>([]);
  const [jwt, setJwt] = useState<string>(Bearer);

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

  const normalPullTodo = async () => {
    const data = await client.graphql({
      query: `
        query GetTodo {
          pullTodo(limit: 10) {
            documents {
              id
              name
              done
              timestamp
              deleted
            }
            checkpoint {
              id
              updatedAt
            }
          }
        }
   
      `,
      variables: {},
    });
    return data;
  };

  const normalPushTodo = async (params: any) => {
    const data = await client.graphql({
      query: `
        mutation PushTodo($row: [TodoInputPushRow!]!) {
            pushTodo(rows: $row) {
              documents {
                id
                name
                done
                timestamp
                deleted
              }
              checkpoint {
                id
                updatedAt
              }
              conflicts {
                  id
                  name
                  done
                  timestamp
                  deleted
              }
            }
        }
      `,
      variables: {
        row: [
          {
            assumedMasterState: params,
            newDocumentState: {
              ...params,
              name: `test-${Math.floor(Math.random() * 1000)}`,
            },
          },
        ],
      },
      // authMode: "lambda",
      // authToken: authToken
    });
    // console.log(JSON.stringify(data, null, 4), " >>>>>>>>>> after pushTodo");
    console.log(data, " >>>>>>>>>> after pushTodo");
    return data;
  };

  const subscribeToTodos = () => {
    console.log("Initializing subscription...");

    const subscription = client
      .graphql({
        query: `
        subscription StreamTodo {
            streamTodo {
                documents {
                    id
                    name
                    done
                    timestamp
                    deleted
                }
                checkpoint {
                    id
                    updatedAt
                }
            }
        }
      `,
        // authMode: "lambda",
        // authToken: authToken
      })
      .subscribe({
        next: (data) => {
          console.log(
            "Subscription data received:",
            JSON.stringify(data, null, 2)
          );
          const eventData = JSON.stringify(data, null, 2);
          console.log(eventData);
          myPullStream$.next({
            documents: eventData.streamTodo.documents,
            checkpoint: eventData.streamTodo.checkpoint,
          });
        },
        error: (error) => {
          console.error("Subscription error:", error);
        },
        complete: () => {
          console.log("Subscription completed");
        },
      });

    // Add connection state logging
    if (subscription.closed) {
      console.log("Subscription is closed");
    } else {
      console.log("Subscription is open");
    }

    return subscription;
  };

  useEffect(() => {
    subscribeToTodos();
  }, [data]);

  async function replicationHandler(): Promise<void> {
    if (!db) return;

    const replicateState = replicateRxCollection({
      collection: db.todos,
      replicationIdentifier: "myTodos",
      push: {
        async handler(changeRows) {
          const rawResponse = await normalPushTodo(changeRows);
          const conflictsArray = rawResponse;
          return conflictsArray;
        },
      },
      pull: {
        async handler(checkpointOrNull, batchSize) {
          const data = await normalPullTodo();
          // console.log(
          //   data.data.pullTodo.documents,
          //   " >>>>>>>>>> after GetTodo"
          // );

          return {
            documents: data.data.pullTodo.documents,
            checkpoint: data.data.pullTodo.checkpoint,
          };
        },
        stream$: myPullStream$.asObservable(),
      },
    });
  }

  async function readDB(): Promise<void> {
    const todoData = await db!.todos.find({}).exec();
    console.log("initiate read => ", todoData.length, todoData);
    setTodo(todoData);
  }

  async function subscribeTodo(): Promise<void> {
    const todoData = db!.todos.find({}).$;
    todoData.subscribe((todoData: TypeTodo[]) => {
      console.log("subscribe todoData", todoData.length, todoData);
      setTodo(todoData);
    });
  }

  useEffect(() => {
    dbInitiation().catch((err) => console.log(err));
  }, []);

  useEffect(() => {
    const handleSubscribeAndRead = async () => {
      try {
        if (db && jwt) {
          await readDB();
          await replicationHandler();
          await subscribeTodo();
        }
      } catch (err) {
        console.error("Subscription or read error:", err);
      }
    };

    handleSubscribeAndRead();
  }, [db, jwt]);

  useEffect(() => {
    // const es = new EventSource(`${REPLICATION_URL}/pull_stream`, {
    //   headers: {
    //     Authorization: {
    //       toString: function () {
    //         return jwt;
    //       },
    //     },
    //   },
    // });
    // const listener: EventSourceListener = (event) => {
    //   if (event.type === "open") {
    //     console.log("Open SSE connection.");
    //   } else if (event.type === "message") {
    //     const eventData = JSON.parse(event.data || "{}");
    //     console.log("--pull-stream", new Date().toISOString(), eventData);
    //     myPullStream$.next({
    //       documents: eventData.documents || [],
    //       checkpoint: eventData.checkpoint,
    //     });
    //   } else if (event.type === "error") {
    //     console.error("Connection error:", event.message);
    //   } else if (event.type === "exception") {
    //     console.error("Error:", event.message, event.error);
    //   }
    // };
    // es.addEventListener("open", listener);
    // es.addEventListener("message", listener);
    // es.addEventListener("error", listener);
    // return () => {
    //   es.removeAllEventListeners();
    //   es.close();
    // };
  }, [jwt]);

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

  async function login(data: any) {
    try {
      const response: Response = await fetch("https://sort.my.id/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "jwt",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const res = await response.json();
      console.log("--result", res.data);
      setJwt(res.data.jwt);
    } catch (error) {
      console.error("--error-login", error);
    }
  }

  return (
    <SafeAreaView style={styles.titleContainer}>
      <View
        style={{
          marginTop: 20,
        }}
      >
        <Button
          title="Login sharkpos"
          onPress={() => {
            login({ username: "sharkpos.course@gmail.com" });
          }}
        />
        <Button
          title="Login dea"
          onPress={() => {
            login({ username: "dea.edria@gmail.com" });
          }}
        />
        <Button
          title="Login fandi"
          onPress={() => {
            login({ username: "irfanfandi38@gmail.com" });
          }}
        />
      </View>
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
