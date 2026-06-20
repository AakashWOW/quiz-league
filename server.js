const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = 3000;

const questions = JSON.parse(
  fs.readFileSync("./questions.json", "utf8")
);

app.use(express.static(path.join(__dirname, "public")));

const state = {
  started: false,
  currentQuestion: -1,
  timer: 15,
  timerRunning: false,
  teams: {},
  answers: {},
  leaderboard: [],
  showAnswer: false
};

for (let i = 1; i <= 16; i++) {
  state.teams[i] = {
  id: i,
  connected: false,
  score: 0,
  socketId: null,
  lastAnswer: null
};
}

let timerHandle = null;

function broadcastState() {
  io.emit("state-update", state);
}

function sendQuestion() {
  const q = questions[state.currentQuestion];

  io.emit("question", {
  number: state.currentQuestion + 1,
  total: questions.length,
  question: q.question,
  options: q.options,
  answer: q.answer
});
}

function startTimer() {
  clearInterval(timerHandle);

  state.timer = 15;
  state.timerRunning = true;

  timerHandle = setInterval(() => {
    state.timer--;

    io.emit("timer", state.timer);

    if (state.timer <= 0) {
      clearInterval(timerHandle);
      state.timerRunning = false;

      io.emit("question-ended");

      broadcastState();
    }
  }, 1000);
}

io.on("connection", (socket) => {

  socket.on("join-team", (teamId) => {

    console.log("Join request:", teamId);

    if (!state.teams[teamId]) {

        console.log("Invalid team:", teamId);

        return;
    }

    console.log(
        "Connected status:",
        state.teams[teamId].connected
    );

    if (state.teams[teamId].connected) {

        console.log("Team already taken");

        socket.emit("team-taken");

        return;
    }

    state.teams[teamId].connected = true;
state.teams[teamId].socketId = socket.id;

socket.teamId = teamId;

socket.emit("team-joined");

console.log("Team joined:", teamId);

broadcastState();
});

  socket.on("submit-answer", (answer) => {

    if (!state.timerRunning) return;

    const teamId = socket.teamId;

    if (!teamId) return;

    if (!state.answers[state.currentQuestion]) {
      state.answers[state.currentQuestion] = {};
    }

    if (state.answers[state.currentQuestion][teamId]) {
      return;
    }

    state.answers[state.currentQuestion][teamId] = answer;

    const correct =
answer === questions[state.currentQuestion].answer;

if(correct){

    state.teams[teamId].score++;

    state.teams[teamId].lastAnswer =
    "correct";

}else{

    state.teams[teamId].lastAnswer =
    "wrong";
}

    broadcastState();
  });

  socket.on("admin-start", () => {

    state.started = true;
    state.currentQuestion = 0;

    sendQuestion();
    startTimer();

    broadcastState();
  });

  socket.on("admin-show-answer", () => {

    state.showAnswer = true;

    broadcastState();

});

  socket.on("admin-next-question", () => {

    state.currentQuestion++;

    if (state.currentQuestion >= questions.length) {

      state.leaderboard =
        Object.values(state.teams)
          .sort((a, b) => b.score - a.score);

      io.emit("quiz-finished", state.leaderboard);

      return;
    }

    Object.values(state.teams)
.forEach(team => {
    team.lastAnswer = null;
});
state.showAnswer = false;
    sendQuestion();
    startTimer();

    broadcastState();
  });

  socket.on("disconnect", () => {

    Object.values(state.teams).forEach(team => {
      if (team.socketId === socket.id) {
        team.connected = false;
        team.socketId = null;
      }
    });

    broadcastState();
  });

  socket.on("admin-reset", () => {

    console.log("LEAGUE RESET");

    clearInterval(timerHandle);

    state.started = false;
    state.currentQuestion = -1;
    state.timer = 15;
    state.timerRunning = false;

    Object.values(state.teams).forEach(team => {

        team.score = 0;
        team.lastAnswer = null;

        // KEEP TEAMS CONNECTED
        // Do NOT touch:
        // team.connected
        // team.socketId

    });

    state.answers = {};
    state.leaderboard = [];

    io.emit("quiz-reset");

    broadcastState();

});

socket.on("admin-pause", () => {

    clearInterval(timerHandle);

    state.timerRunning = false;

});

socket.on("admin-resume", () => {

    if (state.timerRunning) return;

    startTimer();

});

  socket.emit("state-update", state);

  
});



server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

