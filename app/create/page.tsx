import { redirect } from "next/navigation";

export default function CreatePageRedirect(): never {
  redirect("/tasks/create");
}
