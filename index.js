const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;
require('dotenv').config();

app.use(cors());
app.use(express.json());



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

    // jobs api
    app.get('/jobs', async(req, res) =>{
        const cursor = (await jobsCollection).find();
        const result = await cursor.toArray();
        res.send(result);
    })

    app.get('/jobs/:id', async(req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await jobsCollection.findOne(query);
        res.send(result);
    })


    // jobs applications api
    app.post('/applications', async(req, res) =>{
      const application = req.body;
      const result = await applicationCollection.insertOne(application);
      res.send(result);
    })

    app.get('/applications', async(req, res) =>{
      const email = req.query.email;
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
