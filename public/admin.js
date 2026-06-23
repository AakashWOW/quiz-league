const socket=io();

let scoreChart;

window.onload = () => {

    const ctx =
    document.getElementById("scoreChart");

    scoreChart = new Chart(ctx, {

        type: "bar",

        data: {

            labels: [],

            datasets: [{
                label: "Score",
                data: []
            }]
        },

        options: {

    responsive: true,

    scales: {

        x: {
            ticks: {
                font: {
                    size: 18
                }
            }
        },

        y: {
            beginAtZero: true,
            ticks: {
                font: {
                    size: 16
                }
            }
        }
    }
}
    });
};

socket.emit(
    "admin-auth",
    "cyberworldcup-admin-token"
);

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

    const labels = [];
const scores = [];
const colors = [];

Object.values(state.teams).forEach(team => {

    labels.push(
        team.name || ("Team " + team.id)
    );

    scores.push(team.score);

    if(team.lastAnswer === "correct"){

        colors.push("#22c55e");
    }
    else if(team.lastAnswer === "wrong"){

        colors.push("#ef4444");
    }
    else{

        colors.push("#3b82f6");
    }
});

scoreChart.data.labels = labels;

scoreChart.data.datasets[0].data =
scores;

scoreChart.data.datasets[0].backgroundColor =
colors;

scoreChart.update();
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