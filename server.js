const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');
require('dotenv').config({path:'../turniej_strona_back_v2/.env'})

const app = express()
const port = 2137

let refreshTokens = []

const pool =  mysql.createPool({
  host: 'localhost',
  user: 'root',
  database: 'zawody',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})
const promisePool = pool.promise();

const corsOptions = {
  origin: 'http://localhost:3000',
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  const response = {
    status: {
      code: '0',
      message: null
    }
  }

  if (token == null) {
    response.status.code = '401'
    response.status.message = 'Nieprawidłowe wywołanie [NO_AUTH]'
    return res.status(response.status.code).send(response);
  }

  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if (err) {
      sendToLog(req.path, err)
      response.status.code = '403'
      response.status.message = 'Brak dostępu [INV_TOKEN]'
      return res.status(response.status.code).send(response);     
    }

    req.user = decoded

    next()
  })
}
function sendToLog(path, mess, user) {
  const date = new Date()
  console.log('[' + date.toLocaleString("pl-PL") + '] ' + '[' + path + '] ' + '[' + user + '] ' + ': ' + mess)
}
async function checkAdmin(req, res, next) {
  const response = {
    status: {
      code: '0',
      message: null
    }
  }
  const workingData = {
    scope: null,
    error: null
  }
  try {
    const [rows, fields] = await promisePool.execute('SELECT scope FROM users WHERE user_id = ?;',[req.user.uid])
    workingData.scope = JSON.parse(rows[0].scope)
  }
  catch (err) {
    workingData.error = err
    sendToLog(req.path, err)
  }

  if (workingData.error) {
    response.status.code = '500'
    response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
    return res.status(response.status.code).send(response);
  }

  else if (!workingData.scope.includes('admin')) {
    response.status.code = '403'
    response.status.message = 'Niewystarczające uprawnienia do wykonania tej operacji'
    sendToLog(req.path, response.status.message, req.user.uid)
    return res.status(response.status.code).send(response)
  }
  else {
    next()
  }
}
app.use(express.json()) 

app.options('/api/getConfig', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.get('/api/getConfig', cors(corsOptions), async (req, res) => {
  const workingData = {
    config: null,
    error: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    },
    data: null
  }
  /* try {
    const [rows, fields] = await promisePool.execute('SELECT * FROM config;',[])
    workingData.config = rows[0]
  }
  catch (err) {
    workingData.error = err
    sendToLog(req.path, err)
  }

  if (workingData.error) {
    response.status.code = '500'
    response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
    res.status(response.status.code).send(response);
  }

  else if (!workingData.config) {
    response.status.code = '404'
    response.status.message = 'Nie znaleziono konfiguracji'
    res.status(response.status.code).send(response);
  }
  else {
    response.status.code = '200'
    response.status.message = 'OK'
    response.data = workingData.config
    res.status(response.status.code).send(response);
  } */
  response.status.code = '200'
  response.status.message = 'OK [placeholder]'
  response.data = {
    signupOpen: false,
    compName: 'Liga ZSE 2020',
    description: 'Zapisy trwały 3 października 2020 do 18 października 2020. Aktualnie rozpoczęliśmy rundy finałowe. Dalsze informacje będą na Discordzie turniejowym, na którego zapraszamy graczy, a także kibiców, link w zakładce Media społecznościowe',
    logo: true,
    showTrailer: false
  }
  res.status(response.status.code).send(response);
})

app.options('/api/getNews', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.get('/api/getNews', cors(corsOptions), async (req, res) => {
  const workingData = {
    news: null,
    error: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    },
    data: null
  }
  try {
    const [rows, fields] = await promisePool.execute('SELECT arti_id, users.nick, CONCAT(users.name, " ", users.surname) AS full_name, news.date, news.time, title, content FROM news JOIN users ON users.user_id = news.user_id ORDER BY news.date DESC, news.time DESC;',[])
    workingData.news = rows
    workingData.news.forEach(post => {
      const month = parseInt(post.date.getMonth())+parseInt(1)
      const dateString = post.date.getFullYear() + '-' + month + '-' + post.date.getDate()
      post.date = dateString
    })
  }
  catch (err) {
    workingData.error = err
    sendToLog(req.path, err)
  }
  
  if (workingData.error) {
    response.status.code = '500'
    response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
    res.status(response.status.code).send(response);
  }

  else if (!workingData.news.length) {
    response.status.code = '404'
    response.status.message = 'Nie znaleziono aktualności'
    res.status(200).send(response);
  }
  else {
    response.status.code = '200'
    response.status.message = 'OK'
    response.data = workingData.news
    res.status(200).send(response);
  }
})

app.options('/api/getMatches', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.get('/api/getMatches', cors(corsOptions), async (req, res) => {
  const workingData = {
    matches: null,
    error: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    },
    data: null
  }
  try {
    const [rows, fields] = await promisePool.execute('SELECT m.match_id, m.date, m.time, m.team_id_1, m.team_id_2, m.team_id_1_score, m.team_id_2_score, m.note, t.team_name AS team_name_1, t1.team_name AS team_name_2 FROM matches m JOIN teams t on t.team_id = m.team_id_1 JOIN teams t1 on t1.team_id = m.team_id_2 ORDER BY m.date DESC, m.time DESC;',[])
    workingData.matches = rows
    workingData.matches.forEach(match => {
      const month = parseInt(match.date.getMonth())+parseInt(1)
      const dateString = match.date.getFullYear() + '-' + month + '-' + match.date.getDate()
      match.date = dateString
      if (match.team_id_1_score > match.team_id_2_score) {
        match._cellVariants = {
          team_id_1_score: 'success',
          team_id_2_score: 'danger'
        }
      }
      else if (match.team_id_1_score < match.team_id_2_score) {
        match._cellVariants = {
          team_id_1_score: 'danger',
          team_id_2_score: 'success'
        }
      }
      else if (!match.team_id_1_score && !match.team_id_2_score) {
        match._cellVariants = {
          team_id_1_score: 'dark',
          team_id_2_score: 'dark'
        }
      }
      else {
        match._cellVariants = {
          team_id_1_score: 'danger',
          team_id_2_score: 'danger'
        }
      }
    })
  }
  catch (err) {
    workingData.error = err
    sendToLog(req.path, err)
  }
  if (workingData.error) {
    response.status.code = '500'
    response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
    res.status(response.status.code).send(response);
  }
  else if (!workingData.matches.length) {
    response.status.code = '404'
    response.status.message = 'Nie znaleziono meczy'
    res.status(200).send(response);
  }
  else {
    response.status.code = '200'
    response.status.message = 'OK'
    response.data = workingData.matches
    res.status(200).send(response);
  }
})

app.options('/api/getTeams', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.get('/api/getTeams', cors(corsOptions), async (req, res) => {
  const workingData = {
    teams: null,
    error: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    },
    data: null
  }
  try {
    const [rows, fields] = await promisePool.execute('SELECT team_id, team_name, score FROM teams WHERE team_id <> 1 ORDER BY score DESC',[])
    workingData.teams = rows
  }
  catch (err) {
    workingData.error = err
    sendToLog(req.path, err)
  }

  if (workingData.error) {
    response.status.code = '500'
    response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
    res.status(response.status.code).send(response);
  }

  else if (!workingData.teams.length) {
    response.status.code = '404'
    response.status.message = 'Nie znaleziono drużyn'
    res.status(200).send(response);
  }
  else {
    response.status.code = '200'
    response.status.message = 'OK'
    response.data = workingData.teams
    res.status(200).send(response);
  }
})

app.options('/api/getTeam/:team_id', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.get('/api/getTeam/:team_id', cors(corsOptions), async (req, res) => {
  const workingData = {
    team: null,
    users: null,
    error: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    },
    data: {
      team: null,
      users: null
    }
  }
  try {
    const [rows1, fields1] = await promisePool.execute('SELECT team_name, score FROM teams WHERE team_id=?;', [req.params.team_id])
    workingData.team = rows1[0]
  }
  catch (err) {
    workingData.error = err
    sendToLog(req.path, err)
  }
  try {
    const [rows2, fields2] = await promisePool.execute('SELECT user_id, nick, scope, name, surname, cm FROM users WHERE team_id=?;', [req.params.team_id])
    workingData.users = rows2
    workingData.users.forEach(user => {
       user.scope = JSON.parse(user.scope)
       if (user.scope.includes('captain')) user._rowVariant = 'secondary'
       else user._rowVariant = ''
    })
  }
  catch (err) {
    workingData.error = err
    sendToLog(req.path, err)
  }

  if (workingData.error) {
    response.status.code = '500'
    response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
    res.status(response.status.code).send(response);
  }

  else if (!workingData.team) {
    response.status.code = '404'
    response.status.message = 'Nie znaleziono drużyny'
    res.status(200).send(response);
  }
  else if (!workingData.users.length) {
    response.data.team = workingData.team
    response.status.code = '404'
    response.status.message = 'Nie znaleziono graczy'
    res.status(200).send(response);
  }
  else {
    response.data.team = workingData.team
    response.data.users = workingData.users
    response.status.code = '200'
    response.status.message = 'OK'
    res.status(200).send(response);
  }
})

app.options('/api/user/login', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.post('/api/user/login', cors(corsOptions), async (req,res) => {
  const workingData = {
    passhash: null,
    error: null,
    userid: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    },
    data: {
      token: null,
      refreshToken: null
    }
  }
  const badInput = !req.body.uname || !req.body.password
  if (badInput) {
    sendToLog(req.path, 'ktoś się bawił, nieprawidłowe wejście...', req.body.uname)
    response.status.code = '400'
    response.status.message = 'Nieprawidłowe wywołanie [FIELDS]'
    res.status(200).send(response);
  }
  else {
    try {
      const [rows1, fields1] = await promisePool.execute('SELECT passhash FROM users WHERE nick=?',[req.body.uname])
      if (rows1.length) workingData.passhash = rows1[0].passhash.replace('$2y$', '$2a$')
    }
    catch (err) {
      workingData.error = err
      sendToLog(req.path, err)
    }
  
    if (workingData.error) {
      response.status.code = '500'
      response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
      res.status(response.status.code).send(response);
    }
  
    else if (!workingData.passhash) {
      response.status.code = '404'
      response.status.message = 'Nie znaleziono użytkownika!'
      res.status(200).send(response);
    }
  
    else {
      if (!bcrypt.compareSync(req.body.password, workingData.passhash)) {
        response.status.code = '400'
        response.status.message = 'Hasło nieprawidłowe'
        res.status(200).send(response);
      }
      else {
        try {
          const [rows2, fields1] = await promisePool.execute('SELECT user_id FROM users WHERE nick=?',[req.body.uname])
          workingData.userid = rows2[0].user_id
        }
        catch (err) {
          workingData.error = err
          sendToLog(req.path, err)
        }
        if (workingData.error) {
          response.status.code = '500'
          response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
          res.status(response.status.code).send(response);
        }
        else if (!workingData.userid) {
          response.status.code = '404'
          response.status.message = 'Nie znaleziono użytkownika [NO_ID_WITH_NICK]'
          res.status(200).send(response);
        }
        else {
          response.status.code = '200'
          response.status.message = 'OK'
          response.data.token = jwt.sign({ uid: workingData.userid }, process.env.TOKEN_SECRET, { expiresIn: '1m', issuer: '192.168.0.100' })
          response.data.refreshToken = jwt.sign({ uid: workingData.userid }, process.env.REFRESH_TOKEN_SECRET, { issuer: '192.168.0.100' })
          refreshTokens.push(response.data.refreshToken);
          res.status(response.status.code).send(response);
        }
      }
    }
  }
})

app.options('/api/user/refresh', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.post('/api/user/refresh', cors(corsOptions), (req,res) => {
  const workingData = {
    error: null,
  }
  const response = {
    status: {
      code: '0',
      message: null
    },
    data: {
      token: null,
    }
  }
  if (!req.body.refreshToken) {
    sendToLog(req.path, 'ktoś się bawił, nieprawidłowe wejście...')
    response.status.code = '400'
    response.status.message = 'Nieprawidłowe wywołanie [NO_REF_TOKEN]'
    res.status(response.status.code).send(response);
  }
  else if (!refreshTokens.includes(req.body.refreshToken)) {
    response.status.code = '403'
    response.status.message = 'Brak dostępu [REF_TOKEN_REVOKED]'
    res.status(response.status.code).send(response);
  }
  else {
    jwt.verify(req.body.refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        sendToLog(req.path, err)
        response.status.code = '403'
        response.status.message = 'Brak dostępu [INV_REF_TOKEN]' + err   
        res.status(response.status.code).send(response);
      }
      else {
        response.status.code = '200',
        response.status.message = 'OK',
        response.data.token = jwt.sign({ uid: decoded.uid }, process.env.TOKEN_SECRET, { expiresIn: '15s', issuer: '192.168.0.100' })
        res.status(response.status.code).send(response);
      }
    })
  }
})

app.options('/api/user', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.post('/api/user', cors(corsOptions), authenticateToken, async (req,res) => {
  const workingData = {
    error: null,
    user: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    },
    data: {
      user: null
    }
  }
  const badInput = !req.user.uid
  if (badInput) {
    sendToLog(req.path, 'coś się totalnie wykrzaczyło')
    response.status.code = '400'
    response.status.message = 'Nieprawidłowe wywołanie [TOKEN_UID_NOT_PRESENT]'
    res.status(200).send(response);
  }
  else {
    try {
      const [rows, fields] = await promisePool.execute('SELECT users.nick, users.scope, users.name, users.surname, users.usrclass, users.email, users.cm, users.discord, users.paid, teams.team_name, teams.team_admin, teams.invite, teams.team_id FROM users LEFT JOIN teams ON teams.team_id=users.team_id WHERE users.user_id=?;',[req.user.uid])
      workingData.user = rows[0]
      workingData.user.scope = JSON.parse(workingData.user.scope)
    }
    catch (err) {
      workingData.error = err
      sendToLog(req.path, err)
    }
  
    if (workingData.error) {
      response.status.code = '500'
      response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
      res.status(response.status.code).send(response);
    }
  
    else if (!workingData.user) {
      response.status.code = '404'
      response.status.message = 'Nie znaleziono użytkownika [NO_USER_WITH_ID]'
      res.status(response.status.code).send(response);
    }
  
    else {
      response.data.user = workingData.user
      response.status.code = '200'
      response.status.message = 'OK'
      res.status(200).send(response);
    }
  }
})

app.options('/api/user/logout', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.post('/api/user/logout', cors(corsOptions), authenticateToken, (req,res) => {
  const response = {
    status: {
      code: '0',
      message: null
    }
  }
  sendToLog(req.path, JSON.stringify(refreshTokens))
  refreshTokens = refreshTokens.filter(t => {
    //sendToLog(req.path, t)
    const decoded = jwt.decode(t)
    //sendToLog(req.path, decoded.uid)
    decoded.uid !== req.user.uid});
  sendToLog(req.path, JSON.stringify(refreshTokens))

  response.status.code = '200'
  response.status.message = 'OK'
  res.status(response.status.code).send(response);
})

app.options('/api/user/update', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.post('/api/user/update', cors(corsOptions), authenticateToken, async (req,res) => {
  const workingData = {
    error: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    }
  }
  const badInput = !req.body.name || !req.body.surname || !req.body.usrclass || !req.body.cm || !req.body.discord || !req.user.uid
  if (badInput) {
    sendToLog(req.path, 'ktoś się bawił, nieprawidłowe wejście...', req.user.uid)
    response.status.code = '400'
    response.status.message = 'Nieprawidłowe wywołanie [FIELDS]'
    res.status(200).send(response);
  }
  else {
    try {
      const [rows, fields] = await promisePool.execute('UPDATE users SET name = ? , surname = ? , usrclass = ?, cm = ?, discord= ? WHERE user_id = ?;',
      [req.body.name,
      req.body.surname,
      req.body.usrclass,
      req.body.cm,
      req.body.discord,
      req.user.uid])
    }
    catch (err) {
      workingData.error = err
      sendToLog(req.path, err)
    }
    if (workingData.error) {
      response.status.code = '500'
      response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
      res.status(response.status.code).send(response);
    }
    else {
      response.status.code = '200'
      response.status.message = 'Zaktualizowano poprawnie'
      res.status(200).send(response);
    }
  }
})

app.options('/api/admin/sendNews', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.post('/api/admin/sendNews', cors(corsOptions), authenticateToken, checkAdmin, async (req,res) => {
  const workingData = {
    error: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    }
  }
  const date = new Date()
  const month = parseInt(date.getMonth())+parseInt(1)
  const dateString = date.getFullYear() + '-' + month + '-' + date.getDate()
  const timeString = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds()

  const badInput = !req.body.title || !req.body.content
  if (badInput) {
    sendToLog(req.path, 'ktoś się bawił, nieprawidłowe wejście...', req.user.uid)
    response.status.code = '400'
    response.status.message = 'Nieprawidłowe wywołanie [FIELDS]'
    res.status(200).send(response);
  }
  else {
    try {
      const [rows, fields] = await promisePool.execute('INSERT INTO news(user_id, news.date, news.time, title, content) VALUES (?,?,?,?,?);',
      [req.user.uid,
      dateString,
      timeString,
      req.body.title,
      req.body.content])
    }
    catch (err) {
      workingData.error = err
      sendToLog(req.path, err)
    }
    if (workingData.error) {
      response.status.code = '500'
      response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
      res.status(response.status.code).send(response);
    }
    else {
      response.status.code = '200'
      response.status.message = 'Zaktualizowano poprawnie'
      res.status(200).send(response);
    }
  }
  
})

app.options('/api/admin/addMatch', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.post('/api/admin/addMatch', cors(corsOptions), authenticateToken, checkAdmin, async (req,res) => {
  const workingData = {
    error: null,
    note: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    }
  }
  if (!req.body.note) workingData.note = ""
  else workingData.note = req.body.note

  const badInput = !req.body.team_id_1 || !req.body.team_id_2 || !req.body.date || !req.body.time
  if (badInput) {
    sendToLog(req.path, 'ktoś się bawił, nieprawidłowe wejście...', req.user.uid)
    response.status.code = '400'
    response.status.message = 'Nieprawidłowe wywołanie [FIELDS]'
    res.status(200).send(response);
  }
  else {
    try {
      const [rows, fields] = await promisePool.execute('INSERT INTO matches(team_id_1, team_id_2, date, time, note) VALUES (?, ?, ?, ?, ?)',
      [req.body.team_id_1,
      req.body.team_id_2,
      req.body.date,
      req.body.time,
      workingData.note])
    }
    catch (err) {
      workingData.error = err
      sendToLog(req.path, err)
    }
    if (workingData.error) {
      response.status.code = '500'
      response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
      res.status(response.status.code).send(response);
    }
    else {
      response.status.code = '200'
      response.status.message = 'Zaktualizowano poprawnie'
      res.status(200).send(response);
    }
  }
})

app.options('/api/admin/updateMatch', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.post('/api/admin/updateMatch', cors(corsOptions), authenticateToken, checkAdmin, async (req,res) => {
  const workingData = {
    error: null,
    note: '',
    team_1_score: '',
    team_2_score: ''
  }
  const response = {
    status: {
      code: '0',
      message: null
    }
  }

  if (req.body.note) workingData.note = req.body.note
  if (req.body.team_id_1_score) workingData.team_1_score = req.body.team_id_1_score
  if (req.body.team_id_2_score) workingData.team_2_score = req.body.team_id_2_score

  const badInput = !req.body.team_id_1 || !req.body.team_id_2 || !req.body.date || !req.body.time || !req.body.team_id_1_score || !req.body.team_id_2_score || !req.body.match_id
  if (badInput) {
    sendToLog(req.path, 'ktoś się bawił, nieprawidłowe wejście...', req.user.uid)
    response.status.code = '400'
    response.status.message = 'Nieprawidłowe wywołanie [FIELDS]'
    res.status(200).send(response);
  }

  else {
    try {
      const [rows, fields] = await promisePool.execute('UPDATE matches SET team_id_1 = ?, team_id_2 = ?, date = ?, time = ?, team_id_1_score = ?, team_id_2_score = ?, note = ? WHERE match_id = ?;',
      [req.body.team_id_1,
      req.body.team_id_2,
      req.body.date,
      req.body.time,
      workingData.team_1_score,
      workingData.team_2_score,
      workingData.note,
      req.body.match_id
      ])
    }
    catch (err) {
      workingData.error = err
      sendToLog(req.path, err)
    }
    if (workingData.error) {
      response.status.code = '500'
      response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
      res.status(response.status.code).send(response);
    }
    else {
      response.status.code = '200'
      response.status.message = 'Zaktualizowano poprawnie'
      res.status(200).send(response);
    }
  }
})

app.options('/api/admin/getTeam/:team_id', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.get('/api/admin/getTeam/:team_id', cors(corsOptions), authenticateToken, checkAdmin, async (req, res) => {
  const workingData = {
    team: null,
    users: null,
    error: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    },
    data: {
      team: null,
      users: null
    }
  }
  try {
    const [rows1, fields1] = await promisePool.execute('SELECT team_name, score FROM teams WHERE team_id=?;', [req.params.team_id])
    workingData.team = rows1[0]
  }
  catch (err) {
    workingData.error = err
    sendToLog(req.path, err)
  }
  try {
    const [rows2, fields2] = await promisePool.execute('SELECT user_id, nick, scope, name, surname, usrclass, email, cm, discord FROM users WHERE team_id=?;', [req.params.team_id])
    workingData.users = rows2
    workingData.users.forEach(user => {
      user.scope = JSON.parse(user.scope)
      if (user.scope.includes('captain')) user._rowVariant = 'secondary'
      else user._rowVariant = ''
   })
  }
  catch (err) {
    workingData.error = err
    sendToLog(req.path, err)
  }

  if (workingData.error) {
    response.status.code = '500'
    response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
    res.status(response.status.code).send(response);
  }

  else if (!workingData.team) {
    response.status.code = '404'
    response.status.message = 'Nie znaleziono drużyny'
    res.status(200).send(response);
  }
  else if (!workingData.users.length) {
    response.data.team = workingData.team
    response.status.code = '404'
    response.status.message = 'Nie znaleziono graczy'
    res.status(200).send(response);
  }
  else {
    response.data.team = workingData.team
    response.data.users = workingData.users
    response.status.code = '200'
    response.status.message = 'OK'
    res.status(200).send(response);
  }
})

app.options('/api/admin/user/update', cors(corsOptions), (req,res) => {
  res.status(200)
})
app.post('/api/admin/user/update', cors(corsOptions), authenticateToken, checkAdmin, async (req,res) => {
  const workingData = {
    error: null
  }
  const response = {
    status: {
      code: '0',
      message: null
    }
  }
  const badInput = !req.body.name || !req.body.surname || !req.body.scope || !req.body.usrclass || !req.body.cm || !req.body.discord || !req.body.user_id
  if (badInput) {
    sendToLog(req.path, 'ktoś się bawił, nieprawidłowe wejście...', req.user.uid)
    response.status.code = '400'
    response.status.message = 'Nieprawidłowe wywołanie [FIELDS]'
    res.status(200).send(response);
  }
  else {
    try {
      const [rows, fields] = await promisePool.execute('UPDATE users SET name = ? , surname = ? , usrclass = ?, scope = ?, cm = ?, discord = ?, email = ? WHERE user_id = ?;',
      [req.body.name,
      req.body.surname,
      req.body.usrclass,
      req.body.scope,
      req.body.cm,
      req.body.discord,
      req.body.email,
      req.body.user_id])
    }
    catch (err) {
      workingData.error = err
      sendToLog(req.path, err)
    }
    if (workingData.error) {
      response.status.code = '500'
      response.status.message = 'Wewnętrzny błąd serwera ' + workingData.error
      res.status(response.status.code).send(response);
    }
    else {
      response.status.code = '200'
      response.status.message = 'Zaktualizowano poprawnie'
      res.status(200).send(response);
    }
  }
})

app.listen(port, () => {
  console.log(`Słucham cię na http://localhost:${port}`)
})