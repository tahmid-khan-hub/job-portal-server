const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 3000;
require('dotenv').config();

app.use(cors(
  {
  origin: ['http://localhost:5173'],
  credentials: true
  }
));
app.use(express.json());
app.use(cookieParser());


var admin = require("firebase-admin");

var serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// creating a middleware
const logger = (req, res, next) =>{
  console.log('inside the logger middleware');
  next(); // to move to next middleware
}


const verifyToken = (req, res, next) =>{
  const token = req?.cookies?.token;
  console.log('cookie in the middleware', token);

  if(!token){
    return res.status(401).send({message: 'unauthorized access'})
  }

  // verify token
  jwt.verify(token, process.env.JWT_ACCESS_SECRET , (err, decoded) => {
    if(err){
      return res.status(401).send({message: 'unauthorized access'});
    }
    req.decoded = decoded;
    next();
    // console.log(decoded);
  })

}


// verfiy firebase token
const verifyFirebaseToken = async(req, res, next) =>{
  const authHeader = req?.headers?.authorization;

  if(!authHeader || !authHeader.startsWith('Bearer ')){
    return res.status(401).send({message: 'unauthorized access'})
  }

  const token = authHeader.split(' ')[1];


  if(!token){
    return res.status(401).send({message: 'unauthorized access'})
  }

  // console.log('fb token', token);

  // const userInfo = await admin.auth().verifyIdToken(token);
  // console.log('inside the token', userInfo);

  try{
    const decoded = await admin.auth().verifyIdToken(token);
    console.log('decoded token ->', decoded);
    req.decoded = decoded
    next();
  }
  catch(error) {
    return res.status(401).send({message: 'unauthorized access'})
  }

  // req.tokenEmail = userInfo.email;
  // next();

}


const verifyTokenEmail = (req, res, next) =>{
  if(req.query.email !== req.decoded.email){
    return res.status(403).send({message: 'forbidden access'})
  }
  next();
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zc7c13h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();



    const jobsCollection = client.db('jobPortal').collection('jobs');
    const applicationCollection = client.db('jobPortal').collection('applications')

    // jwt token related api
    app.post('/jwt', async(req, res) =>{
      const {email} = req.body;
      const user = {email}; // obj
      const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET , {expiresIn: '1h'});

      // set token in the cookies
      res.cookie('token', token, {
        httpOnly: true, // must use
        secure: false
      })

      res.send({token});
    })



    // jobs api
    app.get('/jobs', async(req, res) =>{

        const email = req.query.email;
        const query = {}; // empty means all data

        if(email){
          query.hr_email = email;
        }

        const cursor = (await jobsCollection).find(query);
        const result = await cursor.toArray();
        res.send(result);
    })


    // could be done but should not be done
    // app.get('/jobsByEmailAddress', async(req, res) =>{
    //   const email = req.query.email;
    //   const query = {hr_email : email};
    //   const result = await jobsCollection.find(query).toArray();
    //   res.send(result);
    // })

    app.get('/jobs/:id', async(req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await jobsCollection.findOne(query);
        res.send(result);
    })

    app.post('/jobs', async(req, res) =>{
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    })


    // jobs applications api
    app.post('/applications', async(req, res) =>{
      const application = req.body;
      const result = await applicationCollection.insertOne(application);
      res.send(result);
    })

    app.patch('/applications/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = {_id : new ObjectId(id)};
      const updatedDoc = {
        $set:{
          status: req.body.status
        }
      }

      const result = await applicationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.get('/applications/job/:job_id', async(req, res) =>{
      const job_id = req.params.job_id;
      const query = {jobId : job_id};
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/applications', logger, verifyFirebaseToken, verifyTokenEmail,  async(req, res) =>{
      const email = req.query.email;

      // console.log('inside application api', req.cookies);

      // if(email !== req.decoded.email){
      //   return res.status(403).send({message: 'forbidden access'})
      // }

      // if(req.tokenEmail != email){
      //   return res.status(403).send({message: 'forbidden access'})
      // }

      const query = { applicant : email }
      const result = await applicationCollection.find(query).toArray();

      // not recomended
      for(const application of result){
        const jobId = application.jobId;
        const jobQuery = {_id : new ObjectId(jobId)};
        const job = await jobsCollection.findOne(jobQuery);
        application.company = job.company;
        application.title = job.title;
        application.company_logo = job.company_logo;
      }

      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) =>{
    res.send('job port main server in delivering');
})

app.listen(port, () =>{
    console.log('job portal main server running');
})
