import type { Metadata } from "next";
import { HomeworkApp } from "./HomeworkApp";

export const metadata: Metadata = {
  title: "Помощь с домашним заданием",
  description: "Объясним задание ребёнку или проверим выполненную работу.",
};

export default function Home() {
  return <HomeworkApp />;
}
