import {
  StyleSheet,
  TextInput,
  Button,
  View,
  FlatList,
  Text,
} from "react-native";
import React, { useEffect, useState } from "react";
import EventSource, { EventSourceListener } from "react-native-sse";

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

addRxPlugin(RxDBDevModePlugin);

import { Subject } from "rxjs";

const myPullStream$ = new Subject<
  RxReplicationPullStreamItem<unknown, unknown>
>();

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

  async function replicationHandler(): Promise<void> {
    // const eventSource = new EventSource(`${REPLICATION_URL}/pull_stream`, {
    //   headers: {
    //     Authorization: {
    //       toString: function () {
    //         return jwt;
    //       },
    //     },
    //   },
    // });
    // eventSource.addEventListener("message", (event) => {
    //   const eventData = JSON.parse(event.data || "{}");
    //   console.log("--pull-stream", new Date().toISOString(), eventData);
    //   myPullStream$.next({
    //     documents: eventData.documents || [],
    //     checkpoint: eventData.checkpoint,
    //   });
    // });
    // eventSource.addEventListener("error", () => myPullStream$.next("RESYNC"));

    // replicateRxCollection({
    //   collection: db!.todos,
    //   replicationIdentifier: "my-http-replication",
    //   push: {
    //     async handler(changeRows) {
    //       console.log("--push-jwt", jwt);
    //       const rawResponse = await fetch(`${REPLICATION_URL}/push`, {
    //         method: "POST",
    //         headers: {
    //           Accept: "application/json",
    //           "Content-Type": "application/json",
    //           Authorization: `${jwt}`,
    //         },
    //         body: JSON.stringify(changeRows),
    //       });
    //       const conflictsArray = await rawResponse.json();
    //       return conflictsArray;
    //     },
    //   },
    //   pull: {
    //     stream$: myPullStream$.asObservable(),
    //     async handler() {
    //       console.log("--pull-jwt", jwt);
    //       //const updatedAt = checkpointOrNull ? checkpointOrNull.updatedAt : 0;
    //       //const id = checkpointOrNull ? checkpointOrNull.id : "";
    //       const response = await fetch(
    //         // `${REPLICATION_URL}?updatedAt=${updatedAt}&id=${id}&limit=${batchSize}`,
    //         `${REPLICATION_URL}/pull`,
    //         {
    //           headers: {
    //             Authorization: `${jwt}`,
    //           },
    //         }
    //       );
    //       const data = await response.json();
    //       console.log("--pull response: ", data);
    //       return {
    //         documents: data.documents,
    //         checkpoint: data.checkpoint,
    //       };
    //     },
    //   },
    // });

    const replicationState: RxGraphQLReplicationState<TypeTodo, CheckPoint> =
      replicateGraphQL({
        collection: db!.todos,
        replicationIdentifier: "my-http-replication",
        url: {
          http: "https://juih7widbnehdgesqg3phhbffq.appsync-api.eu-central-1.amazonaws.com/graphql",
          ws: "wss://juih7widbnehdgesqg3phhbffq.appsync-realtime-api.eu-central-1.amazonaws.com/graphql",
        },
        headers: {
          collection: "todo",
          // "x-api-key": "da2-a2nwvpbs6za2xmnzdqvrfmqwfq",
          host: "juih7widbnehdgesqg3phhbffq.appsync-api.eu-central-1.amazonaws.com",
          Authorization: Bearer,
          "Sec-WebSocket-Protocol": ["graphql-ws"],
        } as any,
        push: {
          batchSize: 100,
          queryBuilder: (rows) => {
            const rowsArray = Array.isArray(rows) ? rows : [rows];

            const query = `mutation PushTodo($writeRows: [TodoInputPushRow!]!) {
      pushTodo(rows: $writeRows) {
        conflictMessages
        checkpoint {
          id
          updatedAt
        }
        conflicts {
          deleted
          done
          id
          name
          timestamp
        }
        documents {
          deleted
          id
          done
          name
          timestamp
        }
      } 
    }`;

            const variables = {
              writeRows: rowsArray, // Use the wrapped array
            };

            return {
              query,
              operationName: "PushTodo",
              variables,
            };
          },
          responseModifier: (plainResponse) => {
            console.log("Push responseModifier", plainResponse);
            return plainResponse.conflicts as MaybePromise<
              ReplicationPushHandlerResult<TypeTodo>
            >;
          },
        },
        pull: {
          batchSize: 100,
          queryBuilder: (checkpoint?: CheckPoint, limit: number = 10) => {
            if (!checkpoint)
              checkpoint = {
                id: "",
                updatedAt: 0,
              };

            const query = `query PullTodos($checkpoint: Checkpoint, $limit: Int!) {
      pullTodo(checkpoint: $checkpoint, limit: $limit){
          checkpoint {
            updatedAt
            id
          }
          documents {
            deleted
            done
            id
            name
            timestamp
          }
        }
      }`;
            return {
              query,
              operationName: "PullTodos",
              variables: {
                checkpoint,
                limit,
              },
            };
          },
          streamQueryBuilder: (headers) => {
            const query = `subscription StreamTodo {
      streamTodo {
        checkpoint {
          id
          updatedAt
        }
        documents {
          deleted
          done
          id
          name
          timestamp
        }
      }    
    }`;
            return {
              query,
              operationName: "StreamTodo",
              variables: null,
            };
          },
          includeWsHeaders: true, // Includes headers as connection parameter to Websocket.
          responseModifier: (plainResponse, origin, requestCheckpoint) => {
            console.log("Pull responseModifier", origin, plainResponse);
            if (origin === "handler") {
              return plainResponse;
            } else if (origin == "stream") {
            }
            return plainResponse;
          },
        },
        deletedField: "deleted",
      });

    replicationState.active$.subscribe((v) => {
      console.log("replication", "active", v);
    });
    replicationState.canceled$.subscribe((v) => {
      console.log("replication", "canceled", v);
    });
    replicationState.error$.subscribe(async (error) => {
      console.log("error", "replication", error);
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
