const socket = io();

let currentTeam = null;
let currentTeamName = "";

let joinedSuccessfully = false;

let currentAnswer = null;
let selectedAnswer = null;

function joinTeam(){

    const teamName =
    document.getElementById("teamName").value.trim();

    if(!teamName){

        alert("Enter a team name");
        return;
    }

    socket.emit(
        "join-team",
        teamName
    );
}

socket.on("question",(data)=>{

    console.log("QUESTION RECEIVED", data);

    document.getElementById("questionNumber")
    .textContent=
    `Question ${data.number}/${data.total}`;

    document.getElementById("questionText")
    .textContent=data.question;

    currentAnswer = data.answer;
    selectedAnswer = null;

    const options=
    document.getElementById("options");

    options.innerHTML="";

    selectedAnswer = null;

    data.options.forEach((opt,index)=>{

        const btn=
        document.createElement("button");

        btn.className="optionBtn";

        btn.textContent=opt;

        btn.onclick=()=>{

            selectedAnswer = index;

socket.emit(
    "submit-answer",
    index
);

            document
            .querySelectorAll(".optionBtn")
            .forEach(b=>b.disabled=true);
        };

        options.appendChild(btn);
    });
});

socket.on("timer",(time)=>{

    document.getElementById("timer")
    .textContent=time;
});

socket.on("state-update",(state)=>{

    if(currentTeam){

        document.getElementById("score")
        .textContent =
        state.teams[currentTeam].score;
    }

    if(state.showAnswer){

        const buttons =
        document.querySelectorAll(".optionBtn");

        buttons.forEach((btn,index)=>{

            if(
    index === currentAnswer &&
    selectedAnswer === currentAnswer
){

    if(
        !btn.querySelector(".answer-overlay")
    ){

        btn.innerHTML += `
        <img
          src="/images/correct.png"
          class="answer-overlay"
        >
        `;
    }
}

            if(
    selectedAnswer !== null &&
    selectedAnswer === index &&
    selectedAnswer !== currentAnswer
){

    if(
        !btn.querySelector(".answer-overlay")
    ){

        btn.innerHTML += `
        <img
          src="/images/wrong.png"
          class="answer-overlay"
        >
        `;
    }
}

        });

    }

});

socket.on("quiz-finished",(leaderboard)=>{

    document.getElementById("quizScreen")
    .style.display="none";

    document.getElementById("finishedScreen")
    .style.display="block";

    let html="<ol>";

    leaderboard.forEach(team=>{

        if(team.score>0){

            html+=
            `<li>Team ${team.id}
            - ${team.score} pts</li>`;
        }
    });

    html+="</ol>";

    document.getElementById("leaderboard")
    .innerHTML=html;
});

socket.on("team-taken",()=>{

    alert(
      "This team is already in use."
    );

});

socket.on("team-joined", (teamName) => {

    console.log("TEAM JOINED EVENT RECEIVED");

    document.getElementById("joinScreen")
    .style.display = "none";

    document.getElementById("quizScreen")
    .style.display = "block";

    document.getElementById("teamLabel")
.textContent =
teamName;
});

socket.on("quiz-reset", () => {

    document.getElementById("score")
    .textContent = "0";

    document.getElementById("questionNumber")
    .textContent = "Waiting for quiz";

    document.getElementById("questionText")
    .textContent = "";

    document.getElementById("options")
    .innerHTML = "";

    document.getElementById("timer")
    .textContent = "15";

});