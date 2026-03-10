import { api } from "./api";
import { nanoid } from "nanoid";

const token = nanoid();

export function getWords() {
  return api.get("/words", {
    headers: { "x-token": token },
  });
}

export function checkWord(word: string) {
  return api.post(`/answer?answer=${word}`, {
    headers: { "x-token": token },
  });
}
