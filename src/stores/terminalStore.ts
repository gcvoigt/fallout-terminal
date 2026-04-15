import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getWords, checkWord } from "../services/apiWords";
import { specialCharacters } from "../constants/special_chars";
import { memoryAddresses } from "../constants/memory_address";
import { getRandomNumber } from "../utils/utils";

const TOTAL_CHARS = 384;
const WORD_LENGTH = 4;
const MAX_COLS = 12;
const MAX_ATTEMPS = 5;

export const useTerminalStore = defineStore("terminal", () => {
  // ============ STATE ============
  const cursorRow = ref(0);
  const cursorCol = ref(0);
  const selectedCol = ref(0); // 0=left, 1=right
  const selectedValue = ref("");

  const leftColumn = ref("");
  const rightColumn = ref("");
  const words = ref([]);
  let wordsArray: string[] = [];
  let indexWords = 0;
  const numAttemps = ref(MAX_ATTEMPS);

  const inputList = ref<string[]>([]);

  // ============ HELPERS (Funções Puras) ============
  const isLetter = (char: string) => /[a-zA-Z]/.test(char);

  const counterChar = (str: string): string | null => {
    const map: Record<string, string> = {
      "{": "}",
      "[": "]",
      "(": ")",
      "<": ">",
    };
    return map[str] || null;
  };

  const findMatchingChar = (
    str: string,
    line: string[],
  ): { start: number; end: number } | null => {
    const matchingChar = counterChar(str);
    if (!matchingChar) return null;

    const aCharPosition = line.indexOf(str);
    const bCharPosition = line.indexOf(matchingChar);

    if (line.includes(matchingChar) && aCharPosition < bCharPosition) {
      for (let i = aCharPosition + 1; i < bCharPosition; i++) {
        if (isLetter(line[i])) {
          return null;
        }
      }
      return { start: aCharPosition, end: bCharPosition };
    }
    return null;
  };

  // ============ GETTERS ============
  const leftLines = computed(() => {
    const lines: string[][] = [];
    for (let i = 0; i < leftColumn.value.length; i += MAX_COLS) {
      lines.push(leftColumn.value.slice(i, i + MAX_COLS).split(""));
    }
    return lines;
  });

  const rightLines = computed(() => {
    const lines: string[][] = [];
    for (let i = 0; i < rightColumn.value.length; i += MAX_COLS) {
      lines.push(rightColumn.value.slice(i, i + MAX_COLS).split(""));
    }
    return lines;
  });

  const leftMemoryAddresses = computed(() => {
    return memoryAddresses.slice(0, memoryAddresses.length / 2).join("\n");
  });

  const rightMemoryAddresses = computed(() => {
    return memoryAddresses.slice(memoryAddresses.length / 2).join("\n");
  });

  const selectedWord = computed(() => findWordAtCursor());

  // ============ ACTIONS ============

  const getCurrentLines = () => {
    return selectedCol.value === 0 ? leftLines.value : rightLines.value;
  };

  const selectedChar = (): string | null => {
    const currentLines = getCurrentLines();
    const line = currentLines[cursorRow.value];
    if (!line) return null;
    return line[cursorCol.value] || null;
  };

  const findWordAtCursor = (): string | null => {
    const currentLines = getCurrentLines();
    const line = currentLines[cursorRow.value];
    if (!line) return null;
    if (!isLetter(line[cursorCol.value])) return null;

    let start = cursorCol.value;
    let end = cursorCol.value;

    while (start > 0 && isLetter(line[start - 1])) start--;
    while (end < line.length && isLetter(line[end])) end++;

    let word = line.slice(start, end).join("");

    // Expandir para trás
    if (start === 0 && cursorRow.value > 0 && word.length < WORD_LENGTH) {
      const prevLine = currentLines[cursorRow.value - 1];
      if (prevLine && isLetter(prevLine[prevLine.length - 1])) {
        let prevEnd = prevLine.length - 1;
        while (prevEnd >= 0 && isLetter(prevLine[prevEnd])) {
          prevEnd--;
        }
        const prevWord = prevLine.slice(prevEnd + 1).join("");
        word = prevWord + word;
      }
    }

    // Expandir para frente
    if (
      end === line.length &&
      word.length < WORD_LENGTH &&
      cursorRow.value < currentLines.length - 1
    ) {
      const nextLine = currentLines[cursorRow.value + 1];
      if (nextLine && isLetter(nextLine[0])) {
        let nextStart = 0;
        while (nextStart < nextLine.length && isLetter(nextLine[nextStart])) {
          nextStart++;
        }
        const nextWord = nextLine.slice(0, nextStart).join("");
        word = word + nextWord;
      }
    }

    selectedValue.value = word.trim();
    return word.trim() || null;
  };

  const getWordBoundariesAtCursor = (): {
    start: { row: number; col: number };
    end: { row: number; col: number };
  } | null => {
    const currentLines = getCurrentLines();
    const line = currentLines[cursorRow.value];
    if (!line || !isLetter(line[cursorCol.value])) return null;

    let start = cursorCol.value;
    let end = cursorCol.value;

    while (start > 0 && isLetter(line[start - 1])) start--;
    while (end < line.length && isLetter(line[end])) end++;

    let wordStart = { row: cursorRow.value, col: start };
    let wordEnd = { row: cursorRow.value, col: end };

    if (start === 0 && cursorRow.value > 0) {
      const prevLine = currentLines[cursorRow.value - 1];
      if (prevLine && isLetter(prevLine[prevLine.length - 1])) {
        let prevStart = prevLine.length - 1;
        while (prevStart > 0 && isLetter(prevLine[prevStart - 1])) prevStart--;
        wordStart = { row: cursorRow.value - 1, col: prevStart };
      }
    }

    if (end === line.length && cursorRow.value < currentLines.length - 1) {
      const nextLine = currentLines[cursorRow.value + 1];
      if (nextLine && isLetter(nextLine[0])) {
        let nextStart = 0;
        while (nextStart < nextLine.length && isLetter(nextLine[nextStart])) {
          nextStart++;
        }
        if (nextStart > 0) {
          wordEnd = { row: cursorRow.value + 1, col: nextStart };
        }
      }
    }

    return { start: wordStart, end: wordEnd };
  };

  const checkHighlightBrackets = (
    col: number,
    row: number,
    col_pos: number,
  ): boolean => {
    const currentLines = getCurrentLines();
    const line = currentLines[row];
    if (!line || selectedCol.value !== col) return false;

    const char = line[cursorCol.value];
    const openChars = ["{", "[", "(", "<"];

    if (openChars.includes(char)) {
      const matchInfo = findMatchingChar(char, line);
      if (matchInfo) {
        return (
          col_pos >= matchInfo.start &&
          col_pos <= matchInfo.end &&
          cursorRow.value === row
        );
      }
    }
    return false;
  };

  const getInCurrentWord = (
    col: number,
    row: number,
    col_pos: number,
  ): boolean => {
    const currentLines = getCurrentLines();

    if (selectedCol.value !== col) return false;

    const cursorLine = currentLines[cursorRow.value];
    if (!cursorLine || !isLetter(cursorLine[cursorCol.value])) return false;

    let start = cursorCol.value;
    let end = cursorCol.value;

    while (start > 0 && isLetter(cursorLine[start - 1])) start--;
    while (end < cursorLine.length && isLetter(cursorLine[end])) end++;

    let wordStart = { row: cursorRow.value, col: start };
    let wordEnd = { row: cursorRow.value, col: end };

    if (start === 0 && cursorRow.value > 0) {
      const prevLine = currentLines[cursorRow.value - 1];
      if (prevLine && isLetter(prevLine[prevLine.length - 1])) {
        let prevStart = prevLine.length - 1;
        while (prevStart > 0 && isLetter(prevLine[prevStart - 1])) prevStart--;
        wordStart = { row: cursorRow.value - 1, col: prevStart };
      }
    }

    if (
      end === cursorLine.length &&
      end - start < WORD_LENGTH &&
      cursorRow.value < currentLines.length - 1
    ) {
      const nextLine = currentLines[cursorRow.value + 1];
      if (nextLine && isLetter(nextLine[0])) {
        let nextEnd = 0;
        while (nextEnd < nextLine.length && isLetter(nextLine[nextEnd])) {
          nextEnd++;
        }
        if (end - start + nextEnd === WORD_LENGTH) {
          wordEnd = { row: cursorRow.value + 1, col: nextEnd };
        }
      }
    }

    if (wordStart.row === wordEnd.row) {
      return (
        row === wordStart.row &&
        col_pos >= wordStart.col &&
        col_pos < wordEnd.col
      );
    } else {
      if (row === wordStart.row) {
        return (
          col_pos >= wordStart.col &&
          col_pos < currentLines[wordStart.row].length
        );
      } else if (row === wordEnd.row) {
        return col_pos < wordEnd.col;
      } else if (row > wordStart.row && row < wordEnd.row) {
        return true;
      }
      return false;
    }
  };

  const isPositionHighlighted = (
    col: number,
    row: number,
    col_pos: number,
  ): boolean => {
    if (getInCurrentWord(col, row, col_pos)) {
      return true;
    }
    if (checkHighlightBrackets(col, row, col_pos)) {
      return true;
    }
    return false;
  };

  const moveToNextWordBoundary = (direction: string): boolean => {
    const currentLines = getCurrentLines();
    const maxRows = currentLines.length;

    const char = selectedChar();
    if (!char || !isLetter(char)) return false;

    const boundaries = getWordBoundariesAtCursor();
    if (!boundaries) return false;

    const { start, end } = boundaries;

    if (direction === "right") {
      if (end.col < MAX_COLS) {
        cursorRow.value = end.row;
        cursorCol.value = end.col;
        return true;
      } else if (end.row < maxRows - 1) {
        cursorRow.value = end.row + 1;
        cursorCol.value = 0;
        return true;
      }
    } else if (direction === "left") {
      if (start.col > 0) {
        cursorRow.value = start.row;
        cursorCol.value = start.col - 1;
        return true;
      } else if (start.row > 0) {
        cursorRow.value = start.row - 1;
        cursorCol.value = MAX_COLS - 1;
        return true;
      }
    }

    return false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const currentLines = getCurrentLines();
    const maxRows = currentLines.length;

    switch (e.key) {
      case "ArrowUp":
        if (cursorRow.value > 0) cursorRow.value--;
        e.preventDefault();
        break;
      case "ArrowDown":
        if (cursorRow.value < maxRows - 1) cursorRow.value++;
        e.preventDefault();
        break;
      case "ArrowLeft":
        if (!moveToNextWordBoundary("left")) {
          if (cursorCol.value > 0) {
            cursorCol.value--;
          } else if (selectedCol.value === 1 && cursorCol.value === 0) {
            selectedCol.value = 0;
            cursorCol.value = MAX_COLS - 1;
          }
        }
        e.preventDefault();
        break;
      case "ArrowRight":
        if (!moveToNextWordBoundary("right")) {
          if (cursorCol.value < MAX_COLS - 1) {
            cursorCol.value++;
          } else if (
            selectedCol.value === 0 &&
            cursorCol.value === MAX_COLS - 1
          ) {
            selectedCol.value = 1;
            cursorCol.value = 0;
          }
        }
        e.preventDefault();
        break;
      case "Enter":
        inputedWords();
        sendAnswer();
        e.preventDefault();
        break;
    }

    const char = selectedChar();
    if (char) {
      selectedValue.value = getSelectedValue();
    }
  };

  const getSelectedValue = (): string => {
    const currentLines = getCurrentLines();
    const line = currentLines[cursorRow.value];
    if (!line) return "";

    const char = line[cursorCol.value];
    if (!char) return "";

    if (isLetter(char)) {
      const word = findWordAtCursor();
      return word || "";
    }

    const openChars = ["{", "[", "(", "<"];
    if (openChars.includes(char)) {
      const matchInfo = findMatchingChar(char, line);
      if (matchInfo) {
        const betweenChars = line
          .slice(matchInfo.start, matchInfo.end + 1)
          .join("");
        return betweenChars;
      }
    }

    return char;
  };

  const generateColumns = () => {
    let markIndex = 0;
    for (let i = 0; i < TOTAL_CHARS / 2; i++) {
      leftColumn.value +=
        specialCharacters[getRandomNumber(0, specialCharacters.length - 1)];
      if (
        indexWords < wordsArray.length &&
        Math.random() < 0.05 &&
        i < TOTAL_CHARS / 2 - 4
      ) {
        if (i - markIndex > 10) {
          leftColumn.value += wordsArray[indexWords];
          indexWords++;
          markIndex = i;
          i += 4;
        }
      }
    }

    markIndex = 0;
    for (let i = 0; i < TOTAL_CHARS / 2; i++) {
      rightColumn.value +=
        specialCharacters[getRandomNumber(0, specialCharacters.length - 1)];
      if (
        indexWords < wordsArray.length &&
        Math.random() < 0.05 &&
        i < TOTAL_CHARS / 2 - 4
      ) {
        if (i - markIndex > 10) {
          rightColumn.value += wordsArray[indexWords];
          indexWords++;
          markIndex = i;
          i += 4;
        }
      }
    }
  };

  const inputedWords = () => {
    const word = selectedWord.value;
    if (word) {
      console.log("Word entered:", word);
      inputList.value.push(`>${word}`);
    }
  };

  const inputedWordHandler = (data: any) => {
    if (data.result === "wrong") {
      inputList.value.push(">Entry denied", `>Likeness=${data.likeness}`);
    }
  };

  const sendAnswer = async () => {
    const word = findWordAtCursor();
    if (!word) {
      return;
    }
    console.log("Answer sent:", word);
    const response = await checkWord(word);
    numAttemps.value--;

    if (numAttemps.value <= 0) {
      // fazer a lógica de bloqueio do sistema aqui, como mostrar uma mensagem ou desabilitar a entrada
      inputList.value.push(">System locked");
      return;
    }
    return inputedWordHandler(response.data);
  };

  const initializeGame = async () => {
    const response = await getWords();
    words.value = response.data;
    wordsArray = response.data.words || [];
    generateColumns();
  };

  return {
    // State
    cursorRow,
    cursorCol,
    selectedCol,
    selectedValue,
    leftColumn,
    rightColumn,
    words,
    inputList,
    numAttemps,

    // Getters
    leftLines,
    rightLines,
    leftMemoryAddresses,
    rightMemoryAddresses,
    selectedWord,

    // Actions
    handleKeyDown,
    sendAnswer,
    inputedWords,
    initializeGame,
    isPositionHighlighted,
    getCurrentLines,
  };
});
