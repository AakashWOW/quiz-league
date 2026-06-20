const socket = io();

let currentTeam = null;

let joinedSuccessfully = false;

for(let i=1;i<=16;i++){

    const option=document.createElement("option");

    option.value=i;
    option.textContent="Team "+i;

    document.getElementById("teamSelect")
    .appendChild(option);
}

function joinTeam(){

    const team =
    document.getElementById("teamSelect").value;

    if(!team){
        alert("Select a team");
        return;
    }

    currentTeam = Number(team);

    socket.emit(
        "join-team",
        currentTeam
    );
}

socket.on("question",(data)=>{

    console.log("QUESTION RECEIVED", data);

    document.getElementById("questionNumber")
    .textContent=
    `Question ${data.number}/${data.total}`;

    document.getElementById("questionText")
    .textContent=data.question;

    const options=
    document.getElementById("options");

    options.innerHTML="";

    data.options.forEach((opt,index)=>{

        const btn=
        document.createElement("button");

        btn.className="optionBtn";

        btn.textContent=opt;

        btn.onclick=()=>{

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
        .textContent=
        state.teams[currentTeam].score;
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

socket.on("team-joined", () => {

    console.log("TEAM JOINED EVENT RECEIVED");

    document.getElementById("joinScreen")
    .style.display = "none";

    document.getElementById("quizScreen")
    .style.display = "block";

    document.getElementById("teamLabel")
    .textContent =
    "Team " + currentTeam;
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