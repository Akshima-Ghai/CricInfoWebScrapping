// node web_scrapping_cricinfo_entracter.js --excel=Worldcup.csv --dataFolder=data --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results 
let minimist = require('minimist');
let axios = require('axios');
let jsdom = require('jsdom');
let excel = require('excel4node');
let pdf = require('pdf-lib');
let fs = require('fs');
let path = require('path');
let rgb = pdf.rgb;

let args = minimist(process.argv);
// console.log(args.excel);
// console.log(args.dataFolder);
// console.log(args.source);

let responseKaPromise = axios.get(args.source);
responseKaPromise.then(function (response) {
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    // let title = document.title;
    // console.log(title);
    let matches = [];
    let matchScoreDivs = document.querySelectorAll("div.match-score-block");
    for (let i = 0; i < matchScoreDivs.length; i++) {
        
        let match = {
            // t1: "",
            // t2: "",
            // t1s: "",
            // t2s: "",
            // result:""
        };
        
        let namePs = matchScoreDivs[i].querySelectorAll("p.name");
        match.t1 = namePs[0].textContent;
        match.t2 = namePs[1].textContent;

        let scoreSpans = matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");
        if (scoreSpans.length == 2) {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = scoreSpans[1].textContent;
        } else if (scoreSpans.length == 1) {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = "";
        } else {
            match.t1s = "";
            match.t2s = "";
        }

        let spanResult = matchScoreDivs[i].querySelector("div.status-text > span");
        match.result = spanResult.textContent;
        matches.push(match);
        // console.log(match);
       
    }
    
    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesJSON, "utf-8");
    let teams = [];
    for (let i = 0; i < matches.length; i++){
        pushTeam(teams, matches[i].t1);
        pushTeam(teams, matches[i].t2);
    }


    for (let i = 0; i < matches.length; i++){
        // console.log(matches);
        pushMatchInAppropriateTeam(teams, matches[i].t1, matches[i].t2, matches[i].t1s, matches[i].t2s, matches[i].result);
        pushMatchInAppropriateTeam(teams, matches[i].t2, matches[i].t1, matches[i].t2s, matches[i].t1s, matches[i].result);
        
    }


    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsJSON, "utf-8");

    prepareExcel(teams, args.excel);

    prepareFoldersAndPDFs(teams, args.dataFolder);

}).catch(function (err) {
    console.log(err);
});


function prepareFoldersAndPDFs(teams, dataFolder) {
    if (fs.existsSync(dataFolder) == false) {
        fs.mkdirSync(dataFolder,{recursive:true});
    }
    

    for (let i = 0; i < teams.length; i++){
        let teamFolderName = path.join(dataFolder, teams[i].name);
        fs.mkdirSync(teamFolderName);

        for (let j = 0; j < teams[i].matches.length; j++){
            let match = teams[i].matches[j];
            createMatchScoreCardPDF(teamFolderName,teams[i].name,match)
        }
    }
    
}

function createMatchScoreCardPDF(teamFolderName, homeTeam, match) {
    // console.log(match);
    let matchFileName = path.join(teamFolderName, match.vs);
    let templateFileBytes = fs.readFileSync('template.pdf');
    let pdfDocKaPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfDocKaPromise.then(function (pdfdoc) {
        let page = pdfdoc.getPage(0);
    //    console.log(match);
        // console.log(match.oppScore);
        // console.log(match.selfScore);
       // console.log(homeTeam);
        // console.log(match.result);
        let t2 = match.vs
        // page.drawText("Hello");
        page.drawText(homeTeam, {
            x: 310,
            y: 652,
            size: 10,
            // color: rgb(0.95, 0.1, 0.1),
        });
        page.drawText(match.vs, {
            x: 310,
            y: 638,
            size: 10
        });

        page.drawText(match.selfScore, {
        x: 310,
            y: 624,
            size: 10
        });

        page.drawText(match.oppScore, {
        x: 310,
            y: 610,
            size: 10
        });

        page.drawText(match.result, {
        x: 310,
            y: 596,
            size: 10
        });
        let changedBytesKaPromise = pdfdoc.save();
        changedBytesKaPromise.then(function (changedBytes) {
            if (fs.existsSync(matchFileName + ".pdf") == true) {
                fs.writeFileSync(matchFileName + "1.pdf", changedBytes);
            } else {
                fs.writeFileSync(matchFileName + ".pdf", changedBytes);
            }
            
        })
    })
}

function prepareExcel(teams, excelFileName) {
    let wb = new excel.Workbook();
    for (let i = 0; i < teams.length; i++){
        let tsheet = wb.addWorksheet(teams[i].name);

        tsheet.cell(1, 1).string("VS");
        tsheet.cell(1, 2).string("Self Score");
        tsheet.cell(1, 3).string("Opp Score");
        tsheet.cell(1, 4).string("Result");

        for (let j = 0; j < teams[i].matches.length; j++){
            tsheet.cell(2+j, 1).string(teams[i].matches[j].vs);
            tsheet.cell(2+j, 2).string(teams[i].matches[j].selfScore);
            tsheet.cell(2+j, 3).string(teams[i].matches[j].oppScore);
            tsheet.cell(2+j, 4).string(teams[i].matches[j].result);
        }
    }
    wb.write('Excel.xlsx');
}

function pushMatchInAppropriateTeam(teams, homeTeam, oppTeam, homeScore, oppScore, result) {
    let t1idx = -1;
        for (let j = 0; j < teams.length; j++) {
            if (teams[j].name == homeTeam) {
                t1idx = j;
                break;
            }
    }
    
    let team = teams[t1idx];
    team.matches.push({
        vs: oppTeam,
        selfScore: homeScore,
        oppScore: oppScore,
        result:result
    })
}
function pushTeam(teams, teamName) {
    let t1idx = -1;
        for (let j = 0; j < teams.length; j++) {
            if (teams[j].name == teamName) {
                t1idx = j;
                break;
            }
        }
        if (t1idx == -1) {
            let team = {
                name: teamName,
                matches:[]
            }
            teams.push(team);
        }
}

