const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    console.log(jwtToken);
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `select * from user where username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const comparePassword = await bcrypt.compare(password, dbUser.password);
    if (comparePassword == true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2

const convertObject = (object) => ({
  stateId: object.state_id,
  stateName: object.state_name,
  population: object.population,
});

app.get("/states/", authenticateToken, async (request, response) => {
  const getStateQuery = `select * from state`;
  const data = await db.all(getStateQuery);
  response.send(data.map((eachObject) => convertObject(eachObject)));
});

//API 3

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateObjQuery = `select * from state where state_id = ${stateId}`;
  const stateObject = await db.get(getStateObjQuery);
  response.send({
    stateId: stateObject.state_id,
    stateName: stateObject.state_name,
    population: stateObject.population,
  });
});

//API 4

app.post("/districts", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `insert into district(district_name,state_id,cases,cured,active,deaths)
  values ('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectDistrictQuery = `select * from district where district_id = '${districtId}';`;
    const districtObject = await db.get(selectDistrictQuery);
    const formattedObject = {
      districtId: districtObject.district_id,
      districtName: districtObject.district_name,
      stateId: districtObject.state_id,
      cases: districtObject.cases,
      cured: districtObject.cured,
      active: districtObject.active,
      deaths: districtObject.deaths,
    };
    response.send(formattedObject);
  }
);

// API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteObjectQuery = `select * from district where district_id = '${districtId}';`;
    await db.run(deleteObjectQuery);
    response.send("District Removed");
  }
);

//API 7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `update district set 
    state_id='${stateId}',cases = '${cases}',cured='${cured}',active='${active}',deaths='${deaths}' 
    where district_id ='${districtId}';`;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

/// API 8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStats = `
    select 
        SUM(cases) as totalCases,
        SUM(cured) as totalCured,
        SUM(active) as totalActive,
        SUM(deaths) as totalDeaths
    from 
       district 
    where 
       state_id = '${stateId}';`;
    const dbObject = await db.get(getStateStats);
    response.send(dbObject);
  }
);

module.exports = app;
