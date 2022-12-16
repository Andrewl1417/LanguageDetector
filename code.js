const {Translate} = require('@google-cloud/translate').v2;
const http = require("http");
const path = require("path");
const fs = require("fs")
const express = require("express");   
const app = express();
const bodyParser = require("body-parser");
require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') })
process.stdin.setEncoding("utf8");

const portNumber = 5002;
const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion} = require("mongodb");
const uri = `mongodb+srv://${userName}:${password}@cluster0.1gqcq3a.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
app.set("views", path.resolve(__dirname, "templates"))
app.set("view engine", "ejs")
app.use(bodyParser.urlencoded({extended:false}))
app.use(express.static(__dirname + '/templates'));
const translate = new Translate();
process.env.GOOGLE_APPLICATION_CREDENTIALS = "./credentials/key.json"

// const {GoogleAuth} = require('google-auth-library');

// async function authorize() {
//     const auth = new GoogleAuth({
//       scopes: ['https://www.googleapis.com/auth/cloud-platform']
//     });
//     const client2 = await auth.getClient();
//     return client2;
//   }

console.log(`Web server started and running at http://localhost:${portNumber}`)
process.stdout.write(`Stop to shutdown the server: `)
process.stdin.on("readable", () => {
    let dataInput = process.stdin.read()
    if (dataInput !== null) {
        let command = dataInput.trim()
        if (command == "stop") {
            console.log("Shutting down the server")
            process.exit(0)
        } else {
            console.log(`Invalid command: ${command}`)
        }
        process.stdout.write("Stop to shutdown the server: ")
        process.stdin.resume()
    }
})


app.get("/", (request, response) => {
    response.render("index");
});

app.get("/detectLanguage", (request, response) => {
    response.render("detectLanguage");
});

app.post("/processLanguage", async (request, response) => {
    try {
        const [languages] = await translate.getLanguages();
        let lang= ``;
        let {sentence} = request.body;
        let [detections] = await translate.detect(sentence);
        detections = Array.isArray(detections) ? detections : [detections];
        detections.forEach(detection => {
            lang += `${detection.input} => `; 
            langObj = languages.find((lang) => {
                return lang.code == detection.language
            })
            lang += `${langObj.name}`
        });
          
        let data = {
            result: lang
        };
        await client.connect();

        await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .insertOne(data);
        response.render("processLanguage", data);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

app.get("/supportedLanguage", async (request, response) => {
    // Lists available translation language with their names in English (the default).
    const [languages] = await translate.getLanguages();
    let result = '<table border="1px solid black">';
    result += '<tr><th>Languages</th></tr>';
    languages.forEach(language =>{
        result += "<tr><td>" + language.name + "</td></tr>"
    });
    result += '</table>';
    let table = {
        languageTable: result
    }
    response.render("supportedLanguage", table);  
});

app.get("/history", async (request, response) => {
    try {
        let arr;
        await client.connect();
        arr = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection).find({}).toArray();
        let table = "<table border=\"1px solid black\">";
        table += "<tr><th>List of phrases</th></tr>";
        arr.forEach(element => {
            table += "<tr><td>" + element.result + "</td></tr>";
        })
        table += "</table>"
        let result = {
            phrases: table
        };
        response.render("history", result);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
})

app.get("/clear", async (request, response) => {
    try {
        await client.connect();
        const result = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .deleteMany({});
        response.render("clear")
    } finally {
        await client.close();
    }

})

let webServer = http.createServer(app);
webServer.listen(portNumber);