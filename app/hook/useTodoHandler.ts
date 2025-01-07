import { useState, useEffect } from "react";

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

function useTodoHandlers(db: any) {
  const [data, setData] = useState({
    id: `RN ` + Math.random().toString(36).substr(2, 9),
    name: "",
  });
  const [todo, setTodo] = useState<TypeTodo[]>([]);

  // Change Handler
  const changeHandler = (key: string, value: string): void => {
    const dataToChange = { ...data, [key]: value };
    setData(dataToChange);
  };

  // Delete Handler
  const deleteHandler = async (id: string): Promise<void> => {
    const selectedId = await db!.todos.find({
      selector: {
        id,
      },
    });
    await selectedId.remove();
    console.log("Deleted ID => ", id);
  };

  // Submit Handler (Insert or Update)
  const submitHandler = async (): Promise<void> => {
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
          timestamp: Date.now(),
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
  };

  // Read DB
  const readDB = async (): Promise<void> => {
    const todoData = await db!.todos.find({}).exec();
    setTodo(todoData);
  };

  // Subscribe to DB Changes
  const subscribeTodo = (): void => {
    const todoData = db!.todos.find({}).$;
    todoData.subscribe((todoData: TypeTodo[]) => {
      setTodo(todoData);
    });
  };

  return {
    data,
    todo,
    readDB,
    setData,
    subscribeTodo,
    changeHandler,
    deleteHandler,
    submitHandler,
  };
}

export default useTodoHandlers;
