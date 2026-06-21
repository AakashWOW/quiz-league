const socket=io();

function startQuiz(){

    socket.emit("admin-start");
}

function showAnswer(){

    socket.emit(
        "admin-show-answer"
    );
}

function nextQuestion(){

    console.log("NEXT BUTTON CLICKED");

    socket.emit(
        "admin-next-question"
    );
}

function pauseQuiz(){

    socket.emit(
        "admin-pause"
    );
}

function resumeQuiz(){

    socket.emit(
        "admin-resume"
    );
}

function resetQuiz(){

    socket.emit(
        "admin-reset"
    );
}

socket.on("question",(data)=>{

    window.currentQuestionData = data;

    document
    .getElementById("currentQuestion")
    .textContent =
    `Q${data.number}: ${data.question}`;

    let html = "";

    data.options.forEach((option,index)=>{

        html += `
        <div
            class="admin-option"
            id="adminOption${index}"
        >
            ${option}
        </div>
        `;
    });

    document
    .getElementById("questionOptions")
    .innerHTML = html;
});

socket.on("timer",(time)=>{

    document
    .getElementById("currentTimer")
    .textContent=time;
});

socket.on("state-update",(state)=>{

    if(
    state.showAnswer &&
    window.currentQuestionData
){

    const option =
    document.getElementById(
      "adminOption" +
      window.currentQuestionData.answer
    );

    if(option){

        option.classList.add(
          "correct-option"
        );
    }
}

    let teamsHTML="";

Object.values(state.teams)
.forEach(team=>{

    let cardClass = "";
let status = "Offline";

let imageHTML = `
<div class="team-icon">⚫</div>
`;

if(team.connected){
    cardClass = "connected";
    status = "Connected";

    imageHTML = `
    <div class="team-icon">🔵</div>
    `;
}

if(team.lastAnswer === "correct"){
    cardClass = "correct";
    status = "Correct";

    imageHTML = `
    <div class="team-icon">
        <img
            src="/images/correct.png"
            alt="Correct"
            class="result-image"
        >
    </div>
    `;
}

if(team.lastAnswer === "wrong"){
    cardClass = "wrong";
    status = "Wrong";

    imageHTML = `
    <div class="team-icon">
        <img
            src="/images/wrong.png"
            alt="Wrong"
            class="result-image"
        >
    </div>
    `;
}

    teamsHTML += `
    <div class="team-card ${cardClass}">
        <h3>Team ${team.id}</h3>

        ${imageHTML}

        <div>${status}</div>

        <div class="team-score">
            ${team.roundScore} pts
        </div>
    </div>
    `;
});

document
.getElementById("teamGrid")
.innerHTML = teamsHTML;

    const sorted=
    Object.values(state.teams)
    .sort(
      (a,b)=>
      b.score-a.score
    );

    let lb = `
<table style="width:100%;border-collapse:collapse;">
<tr>
    <th>Rank</th>
    <th>Team</th>
    <th>Score</th>
</tr>
`;

sorted.forEach((team,index)=>{

    lb += `
    <tr>
        <td>${index + 1}</td>
        <td>Team ${team.id}</td>
        <td>${team.score}</td>
    </tr>
    `;
});

lb += "</table>";

document
.getElementById("leaderboard")
.innerHTML = lb;
});

socket.on("quiz-finished",(leaderboard)=>{

    alert(
      "Quiz Finished"
    );
});

socket.on("quiz-reset", () => {

    document.getElementById("currentQuestion")
    .textContent = "Waiting...";

    document.getElementById("currentTimer")
    .textContent = "15";

});

function resetQuiz(){

    socket.emit(
      "admin-reset"
    );
}

function resumeQuiz(){

    socket.emit(
      "admin-resume"
    );
}