<script setup>
import { onMounted } from "vue";
import { useTerminalStore } from "../stores/terminalStore";

const store = useTerminalStore();

onMounted(async () => {
  await store.initializeGame();
  window.addEventListener("keydown", store.handleKeyDown);
});
</script>

<template>
  <div class="terminal-container">
    <div class="header">
      <p>Welcome to ROBCO Industries (TM) Termlink</p>
      <p>Password required</p>
    </div>
    <div class="attemps-remaining">
      <p>Attempts remaining: {{ store.numAttemps }}</p>
    </div>
    <div class="hack-area">
      <div class="board-game">
        <!-- Coluna esquerda -->
        <div class="code-column">{{ store.leftMemoryAddresses }}</div>
        <div
          class="code-column code-selectable"
          :class="{ active: store.selectedCol === 0 }"
        >
          <div
            v-for="(line, row) in store.leftLines"
            :key="row"
            class="code-line"
          >
            <span
              v-for="(char, col) in line"
              :key="`${row}-${col}`"
              class="char"
              :class="{
                cursor:
                  store.selectedCol === 0 &&
                  store.cursorRow === row &&
                  store.cursorCol === col,
                'word-highlight': store.isPositionHighlighted(0, row, col),
              }"
            >
              {{ char }}
            </span>
          </div>
        </div>
        <!-- Coluna direita -->
        <div class="code-column">{{ store.rightMemoryAddresses }}</div>
        <div
          class="code-column code-selectable"
          :class="{ active: store.selectedCol === 1 }"
        >
          <div
            v-for="(line, row) in store.rightLines"
            :key="row"
            class="code-line"
          >
            <span
              v-for="(char, col) in line"
              :key="`${row}-${col}`"
              class="char"
              :class="{
                cursor:
                  store.selectedCol === 1 &&
                  store.cursorRow === row &&
                  store.cursorCol === col,
                'word-highlight': store.isPositionHighlighted(1, row, col),
              }"
            >
              {{ char }}
            </span>
          </div>
        </div>
      </div>
      <div class="attempts-info">
        <p v-for="word in store.inputList" :key="word">
          {{ word }}
        </p>
        <p>{{ `>${store.selectedValue}` }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header {
  font-family: monospace;
  text-align: left;
  align-items: end;
  padding: 1rem 1rem 0.2rem 1rem;
  & p {
    margin: 0;
    font-size: 0.9rem;
  }
}

.attemps-remaining {
  text-align: left;
  padding: 0 1rem;
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
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-top: 1rem;
  width: 130px;
  line-height: 1.2em;
  & p {
    margin: 0;
    font-size: 0.9rem;
  }
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
</style>
