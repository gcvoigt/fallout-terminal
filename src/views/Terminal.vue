<script setup>
import { ref, onMounted, computed } from "vue";
import { getWords, checkWord } from "../services/apiWords";
import { specialCharacters } from "../constants/special_chars";
import { memoryAddresses } from "../constants/memory_address";
import { getRandomNumber } from "../utils/utils";

const totalchars = 384;
const wordLength = 4;
let indexWords = 0;
const leftColumn = ref("");
const rightColumn = ref("");
const cursorRow = ref(0);
const cursorCol = ref(0);
const selectedCol = ref(0); // 0=left, 1=right

const words = ref([]);
let wordsArray = [];
const allWordsMap = ref(new Map()); // Mapeia posições de todas as palavras

const isLetter = (char) => /[a-zA-Z]/.test(char);

function selectedChar() {
  const currentLines =
    selectedCol.value === 0 ? leftLines.value : rightLines.value;
  const line = currentLines[cursorRow.value];
  if (!line) return null;
  return line[cursorCol.value] || null;
}

function counterChar(str) {
  switch (str) {
    case "{":
      return "}";
    case "[":
      return "]";
    case "(":
      return ")";
    case "<":
      return ">";
    default:
      return null;
  }
}

function findMatchingChar(str, line) {
  const matchingChar = counterChar(str);
  if (!matchingChar) return null;
  const aCharPosition = line.indexOf(str);
  const bCharPosition = line.indexOf(matchingChar);
  if (line.includes(matchingChar) && aCharPosition < bCharPosition) {
    for (let i = aCharPosition + 1; i < bCharPosition; i++) {
      if (isLetter(line[i])) {
        // Check for letters between the characters
        return null; // No gap found
      }
    }
    return { start: aCharPosition, end: bCharPosition }; // Gap found, retorna posições
  }
  return null;
}

function checkHighlightBrackets(col, row, col_pos) {
  const currentLines =
    selectedCol.value === 0 ? leftLines.value : rightLines.value;
  const line = currentLines[row];
  if (!line || selectedCol.value !== col) return false;

  // Se o cursor está em um caractere de abertura
  const char = line[cursorCol.value];
  const openChars = ["{", "[", "(", "<"];

  if (openChars.includes(char)) {
    const matchInfo = findMatchingChar(char, line);
    if (matchInfo) {
      // Destacar caracteres entre aCharPosition e bCharPosition (inclusive)
      return (
        col_pos >= matchInfo.start &&
        col_pos <= matchInfo.end &&
        cursorRow.value === row
      );
    }
  }
  return false;
}

function findWordAtCursor() {
  const currentLines =
    selectedCol.value === 0 ? leftLines.value : rightLines.value;
  const line = currentLines[cursorRow.value];
  if (!line) return null;
  if (!isLetter(line[cursorCol.value])) return null; // If cursor is not on a letter, return null

  let start = cursorCol.value;
  let end = cursorCol.value;

  while (start > 0 && isLetter(line[start - 1])) start--;
  while (end < line.length && isLetter(line[end])) end++;

  let word = line.slice(start, end).join("");

  if (word.length < wordLength) {
    const nextLine = currentLines[cursorRow.value + 1];
    const prevLine = currentLines[cursorRow.value - 1];
    if (nextLine) {
      let nextStart = 0;
      while (nextStart < nextLine.length && isLetter(nextLine[nextStart])) {
        nextStart++;
      }
      const nextWord = nextLine.slice(0, nextStart).join("");
      word = word + nextWord;
    }
    if (prevLine) {
      let prevEnd = prevLine.length - 1;
      while (prevEnd >= 0 && isLetter(prevLine[prevEnd])) {
        prevEnd--;
      }
      const prevWord = prevLine.slice(prevEnd + 1).join("");
      word = prevWord + word;
    }
  }

  console.log("Word at cursor:", word);
  return word.trim() || null;
}

const selectedWord = computed(() => {
  const word = findWordAtCursor();
  return word;
});

function findSecurityGaps(char, row, col) {
  const currentLines =
    selectedCol.value === 0 ? leftLines.value : rightLines.value;
  const line = currentLines[row];
  if (!line) return false;

  const matchResult = findMatchingChar(char, currentLines[row]);
  if (matchResult) {
    return true;
  }
  return false;
}

function getInCurrentWord(col, row, col_pos) {
  const currentLines =
    selectedCol.value === 0 ? leftLines.value : rightLines.value;

  // Se a coluna não corresponde ao cursor, retorna false
  if (selectedCol.value !== col) return false;

  // Se o cursor não está em uma letra, retorna false
  const cursorLine = currentLines[cursorRow.value];
  if (!cursorLine || !isLetter(cursorLine[cursorCol.value])) return false;

  // Encontra o início e fim da palavra na linha do cursor
  let start = cursorCol.value;
  let end = cursorCol.value;
  while (start > 0 && isLetter(cursorLine[start - 1])) start--;
  while (end < cursorLine.length && isLetter(cursorLine[end])) end++;

  let wordStart = { row: cursorRow.value, col: start };
  let wordEnd = { row: cursorRow.value, col: end };

  // Verificar se a palavra começa na linha anterior
  if (start === 0 && cursorRow.value > 0) {
    const prevLine = currentLines[cursorRow.value - 1];
    if (prevLine && isLetter(prevLine[prevLine.length - 1])) {
      // Encontra onde começa a palavra na linha anterior
      let prevStart = prevLine.length - 1;
      while (prevStart > 0 && isLetter(prevLine[prevStart - 1])) prevStart--;
      wordStart = { row: cursorRow.value - 1, col: prevStart };
    }
  }

  // Se a palavra tiver menos de 4 caracteres, verifica a próxima linha
  if (end - start < wordLength) {
    const nextLine = currentLines[cursorRow.value + 1];
    if (nextLine) {
      let nextStart = 0;
      while (nextStart < nextLine.length && isLetter(nextLine[nextStart])) {
        nextStart++;
      }
      if (nextStart > 0) {
        // A palavra continua na próxima linha
        wordEnd = { row: cursorRow.value + 1, col: nextStart };
      }
    }
  }

  // Verifica se a posição atual (row, col_pos) está dentro da palavra
  if (wordStart.row === wordEnd.row) {
    // Palavra em uma única linha
    return (
      row === wordStart.row && col_pos >= wordStart.col && col_pos < wordEnd.col
    );
  } else {
    // Palavra quebrada em múltiplas linhas
    if (row === wordStart.row) {
      // Na primeira linha
      return (
        col_pos >= wordStart.col && col_pos < currentLines[wordStart.row].length
      );
    } else if (row === wordEnd.row) {
      // Na segunda linha (ou última linha)
      return col_pos < wordEnd.col;
    } else if (row > wordStart.row && row < wordEnd.row) {
      // Linhas intermediárias (se houver)
      return true;
    }
    return false;
  }
}

function isPositionHighlighted(col, row, col_pos) {
  // Primeiro verifica se está em uma palavra
  if (getInCurrentWord(col, row, col_pos)) {
    return true;
  }
  // Depois verifica se está em um par de brackets/chaves
  if (checkHighlightBrackets(col, row, col_pos)) {
    return true;
  }
  return false;
}

const leftColumnFormatted = computed(() => {
  return leftColumn.value.replace(/(.{12})/g, "$1\n");
});

const rightColumnFormatted = computed(() => {
  return rightColumn.value.replace(/(.{12})/g, "$1\n");
});

const leftMemoryAddresses = computed(() => {
  return memoryAddresses
    .slice(0, memoryAddresses.length / 2)
    .map((addr, idx) => addr)
    .join("\n");
});

const rightMemoryAddresses = computed(() => {
  return memoryAddresses
    .slice(memoryAddresses.length / 2)
    .map((addr, idx) => addr)
    .join("\n");
});

const leftLines = computed(() => {
  const lines = [];
  for (let i = 0; i < leftColumn.value.length; i += 12) {
    lines.push(leftColumn.value.slice(i, i + 12).split(""));
  }
  return lines;
});

const rightLines = computed(() => {
  const lines = [];
  for (let i = 0; i < rightColumn.value.length; i += 12) {
    lines.push(rightColumn.value.slice(i, i + 12).split(""));
  }
  return lines;
});

function getWordBoundariesAtCursor() {
  const currentLines =
    selectedCol.value === 0 ? leftLines.value : rightLines.value;
  const line = currentLines[cursorRow.value];
  if (!line || !isLetter(line[cursorCol.value])) return null;

  let start = cursorCol.value;
  let end = cursorCol.value;

  while (start > 0 && isLetter(line[start - 1])) start--;
  while (end < line.length && isLetter(line[end])) end++;

  let wordStart = { row: cursorRow.value, col: start };
  let wordEnd = { row: cursorRow.value, col: end };

  // Verificar se a palavra começa na linha anterior
  if (start === 0 && cursorRow.value > 0) {
    const prevLine = currentLines[cursorRow.value - 1];
    if (prevLine && isLetter(prevLine[prevLine.length - 1])) {
      // Encontra onde começa a palavra na linha anterior
      let prevStart = prevLine.length - 1;
      while (prevStart > 0 && isLetter(prevLine[prevStart - 1])) prevStart--;
      wordStart = { row: cursorRow.value - 1, col: prevStart };
    }
  }

  // Se a palavra tiver menos de 4 caracteres, verifica a próxima linha
  if (end - start < wordLength) {
    const nextLine = currentLines[cursorRow.value + 1];
    if (nextLine) {
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
}

function moveToNextWordBoundary(direction) {
  const currentLines =
    selectedCol.value === 0 ? leftLines.value : rightLines.value;
  const maxRows = currentLines.length;
  const maxCols = 12;

  const char = selectedChar();
  if (!char || !isLetter(char)) return false;

  const boundaries = getWordBoundariesAtCursor();
  if (!boundaries) return false;

  const { start, end } = boundaries;

  if (direction === "right") {
    // Move para o próximo caractere após a palavra
    if (end.col < maxCols) {
      cursorRow.value = end.row;
      cursorCol.value = end.col;
      return true;
    } else if (end.row < maxRows - 1) {
      cursorRow.value = end.row + 1;
      cursorCol.value = 0;
      return true;
    }
  } else if (direction === "left") {
    // Move para o caractere antes da palavra
    if (start.col > 0) {
      cursorRow.value = start.row;
      cursorCol.value = start.col - 1;
      return true;
    } else if (start.row > 0) {
      cursorRow.value = start.row - 1;
      cursorCol.value = maxCols - 1;
      return true;
    }
  }

  return false;
}

function handleKeyDown(e) {
  const currentLines =
    selectedCol.value === 0 ? leftLines.value : rightLines.value;
  const maxRows = currentLines.length;
  const maxCols = 12;

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
        } else if (cursorRow.value > 0) {
          cursorRow.value--;
          cursorCol.value = maxCols - 1;
        } else if (
          selectedCol.value === 1 &&
          cursorRow.value === 0 &&
          cursorCol.value === 0
        ) {
          selectedCol.value = 0; // Pula para coluna esquerda
          cursorRow.value = maxRows - 1;
          cursorCol.value = maxCols - 1;
        }
      }
      e.preventDefault();
      break;
    case "ArrowRight":
      if (!moveToNextWordBoundary("right")) {
        if (cursorCol.value < maxCols - 1) {
          cursorCol.value++;
        } else if (cursorRow.value < maxRows - 1) {
          cursorRow.value++;
          cursorCol.value = 0;
        } else if (
          selectedCol.value === 0 &&
          cursorRow.value === maxRows - 1 &&
          cursorCol.value === maxCols - 1
        ) {
          selectedCol.value = 1; // Pula para coluna direita
          cursorRow.value = 0;
          cursorCol.value = 0;
        }
      }
      e.preventDefault();
      break;
    case "Enter":
      sendAnswer();
      e.preventDefault();
      break;
  }
  const char = selectedChar();
  if (char) {
    findSecurityGaps(char, cursorRow.value, cursorCol.value);
    findWordAtCursor();
  }
}

async function sendAnswer() {
  const word = findWordAtCursor();
  if (!word) {
    return;
  }
  if (word) {
    console.log("Answer sent:", word);
    // Aqui você pode adicionar a lógica para verificar a resposta
    const response = await checkWord(word);
    console.log("Response from server:", response);
  }
}

onMounted(async () => {
  const response = await getWords();
  words.value = response.data;
  wordsArray = response.data.words || [];
  console.log("Words Array:", wordsArray);
  generateColumns();
  window.addEventListener("keydown", handleKeyDown);
});

function generateColumns() {
  let markIndex = 0;
  for (let i = 0; i < totalchars / 2; i++) {
    leftColumn.value +=
      specialCharacters[getRandomNumber(0, specialCharacters.length - 1)];
    if (
      indexWords < wordsArray.length &&
      Math.random() < 0.05 &&
      i < totalchars / 2 - 4
    ) {
      // 5% chance to add a word
      if (i - markIndex > 10) {
        leftColumn.value += wordsArray[indexWords];
        indexWords++;
        markIndex = i;
        i += 4; // Skip a few characters to avoid overcrowding
      }
    }
  }
  markIndex = 0;
  for (let i = 0; i < totalchars / 2; i++) {
    rightColumn.value +=
      specialCharacters[getRandomNumber(0, specialCharacters.length - 1)];
    if (
      indexWords < wordsArray.length &&
      Math.random() < 0.05 &&
      i < totalchars / 2 - 4
    ) {
      if (i - markIndex > 10) {
        rightColumn.value += wordsArray[indexWords];
        indexWords++;
        markIndex = i;
        i += 4; // Skip a few characters to avoid overcrowding
      }
    }
  }
  console.log("Left Column:", leftColumn.value);
  console.log("Right Column:", rightColumn.value);
}
</script>

<template>
  <div class="terminal-container">
    <div class="header">
      <p>Welcome to ROBCO Industries (TM) Termlink</p>
      <p>Password required</p>
    </div>
    <div class="hack-area">
      <div class="board-game">
        <!-- Coluna esquerda -->
        <div class="code-column">{{ leftMemoryAddresses }}</div>
        <div
          class="code-column code-selectable"
          :class="{ active: selectedCol === 0 }"
        >
          <div v-for="(line, row) in leftLines" :key="row" class="code-line">
            <span
              v-for="(char, col) in line"
              :key="`${row}-${col}`"
              class="char"
              :class="{
                cursor:
                  selectedCol === 0 && cursorRow === row && cursorCol === col,
                'word-highlight': isPositionHighlighted(0, row, col),
              }"
            >
              {{ char }}
            </span>
          </div>
        </div>
        <!-- Coluna direita -->
        <div class="code-column">{{ rightMemoryAddresses }}</div>
        <div
          class="code-column code-selectable"
          :class="{ active: selectedCol === 1 }"
        >
          <div v-for="(line, row) in rightLines" :key="row" class="code-line">
            <span
              v-for="(char, col) in line"
              :key="`${row}-${col}`"
              class="char"
              :class="{
                cursor:
                  selectedCol === 1 && cursorRow === row && cursorCol === col,
                'word-highlight': isPositionHighlighted(1, row, col),
              }"
            >
              {{ char }}
            </span>
          </div>
        </div>
      </div>
      <div class="attempts-info">
        <p>{{ selectedWord }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header {
  margin-bottom: 1rem;
  font-family: monospace;
  text-align: left;
  padding: 1rem;
  & p {
    margin: 0;
    font-size: 0.9rem;
  }
}

.board-game {
  display: flex;
  gap: 0.5rem;
}

.attempts-info {
  margin-top: 1rem;
  width: 100px;
  /*font-size: 1.2rem;*/
}

.code-column {
  white-space: pre-wrap;
  word-break: break-all;
  overflow-wrap: break-word;
}

.code-selectable {
  display: flex;
  flex-direction: column;
  /*padding: 1px;*/
}

.code-line {
  /* height: 1.2em;*/
  letter-spacing: 0.05em;
  /*line-height: 1.2em;*/
}

.char {
  position: relative;
  transition: all 0.1s ease;
}

.char.cursor {
  background-color: #00ff00;
  color: #000;
  font-weight: bold;
  box-shadow: 0 0 4px rgba(0, 255, 0, 0.8);
}

.char.word-highlight {
  background-color: #00ff00;
  color: #000;
  font-weight: bold;
  box-shadow: 0 0 4px rgba(0, 255, 0, 0.8);
}

/* .code-selectable.active {
  border: 1px solid #00ff00;
} */
</style>
