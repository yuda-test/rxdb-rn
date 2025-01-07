import { RxDatabase } from "rxdb";
import { replicateRxCollection } from "rxdb/plugins/replication";
import { map } from "rxjs/operators";

async function replicationHandler(db: RxDatabase, client: any): Promise<void> {
  const normalPullTodo = async (client: any) => {
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

  const normalPushTodo = async (client: any, params: any) => {
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
            newDocumentState: params.newDocumentState,
            assumedMasterState: params.assumedMasterState,
          },
        ],
      },
    });
    console.log(data, " >>>>>>>>>> after pushTodo");
    return data;
  };

  if (!db) return;

  const subscription = client.graphql({
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
  });

  replicateRxCollection({
    collection: db.todos,
    replicationIdentifier: "myTodos",
    live: true,
    deletedField: "deleted",
    push: {
      async handler(changeRows) {
        const [data] = changeRows;
        // Helper function to extract the relevant fields from a state object
        const extractState = (state: any) => ({
          id: state?.id,
          name: state?.name,
          done: state?.done,
          timestamp: state?.timestamp,
          deleted: state?.deleted,
        });

        const assumedMasterState = data.assumedMasterState
          ? extractState(data.assumedMasterState)
          : null;

        const newDocumentState = extractState(data.newDocumentState);

        try {
          const add = await normalPushTodo(client, {
            newDocumentState,
            assumedMasterState,
          });

          console.log(add);
          return add.data.pushTodo.conflicts;
        } catch (error) {
          console.error("Error pushing todo:", error);
          throw error;
        }
      },
    },
    pull: {
      async handler(checkpointOrNull, batchSize) {
        const data = await normalPullTodo(client);
        console.log(data.data.pullTodo.documents, " >>>>>>>>>> after GetTodo");
        return data.data.pullTodo;
      },
      stream$: subscription.pipe(
        map((wrapper: any) => {
          console.log(JSON.stringify(wrapper, null, 2), "stream >>>>>>>>>>>>");
          return wrapper.data.streamTodo;
        })
      ),
    },
  });
}

export default replicationHandler;
