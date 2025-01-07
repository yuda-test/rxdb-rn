import {
  StyleSheet,
  TextInput,
  Button,
  View,
  FlatList,
  Text,
} from "react-native";
import React, { useEffect, useState } from "react";

import { RxDatabase, addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { SafeAreaView } from "react-native-safe-area-context";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import dbInitiation from "../function/dbInit";
import replicationHandler from "../function/replicateHandler";
import useAuth from "../hook/useAuth";
import useTodoHandlers from "../hook/useTodoHandler";

Amplify.configure({
  API: {
    GraphQL: {
      region: "eu-central-1",
      endpoint: process.env.EXPO_PUBLIC_QUERY_API || "",
      defaultAuthMode: "lambda",
    },
  },
});

addRxPlugin(RxDBDevModePlugin);

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

export default function HomeScreen() {
  const [db, setDB] = useState<RxDatabase>();
  // const [data, setData] = useState({
  //   id: `RN ` + Math.random().toString(36).substr(2, 9),
  //   name: "",
  // });
  // const [todo, setTodo] = useState<TypeTodo[]>([]);
  const { login, jwt, user, loading } = useAuth();
  const {
    data,
    todo,
    readDB,
    setData,
    subscribeTodo,
    changeHandler,
    deleteHandler,
    submitHandler,
  } = useTodoHandlers(db);

  const client = generateClient({
    authToken: jwt,
  });

  useEffect(() => {
    dbInitiation(db!)
      .then((dbConnection) => setDB(dbConnection))
      .catch((err) => console.log(err));
  }, [db]);

  useEffect(() => {
    const handleSubscribeAndRead = async () => {
      try {
        if (db && jwt) {
          await readDB();
          await replicationHandler(db, client);
          await subscribeTodo();
        }
      } catch (err) {
        console.error("Subscription or read error:", err);
      }
    };

    handleSubscribeAndRead();
  }, [db, jwt]);

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
      <View
        style={{
          marginTop: 20,
        }}
      >
        <Button
          title="Login Yuda"
          onPress={async () => {
            await login({
              username: "yuda.mahendra@shark.tech",
              password: "Yuda12345678",
            });
          }}
        />
        <Button
          title="Login fandi"
          onPress={async () => {
            await login({
              username: "irfanfandi38@gmail.com",
              password: "fandi123",
            });
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
        <p>Login as {user}</p>

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
        {loading ? (
          <>Loading...</>
        ) : (
          <FlatList
            data={todo}
            renderItem={({ item }) => <ItemsComponent item={item} />}
            keyExtractor={(item) => item.id}
          />
        )}
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
