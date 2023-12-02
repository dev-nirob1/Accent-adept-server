const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
// const morgan = require('morgan')
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json())
// app.use(morgan('dev'))



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@simplecrud.xgcpsfy.mongodb.net/?retryWrites=true&w=majority`;

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
        const coursesCollection = client.db("accent-adept-DB").collection("courses");
        const usersCollection = client.db("accent-adept-DB").collection("users")
        const selectedClassCollection = client.db("accent-adept-DB").collection("selectedClass")

        // users related api
        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        //store user info in database
        app.put('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            console.log(result)
            res.send(result)
        })

        //update user role to admin 
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        //update user role to instructor 
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    role: 'instrutor'
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        // delete a user from database
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })

        // instructors page api 
        app.get("/instructors", async (req, res) => {
            const result = await coursesCollection.find().toArray()
            res.send(result)
        })

        // top 6 most popular instrutors 

        app.get("/popularInstructors", async (req, res) => {
            const result = await coursesCollection.find().limit(6).toArray();
            res.send(result)
        })

        //classes api
        app.get("/classes", async (req, res) => {
            const result = await coursesCollection.find().toArray()
            res.send(result)
        })

        //get single course info
        app.get("/course/details/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await coursesCollection.findOne(query)
            res.send(result)
        })

        // top 6 most popular classes based on total students
        app.get("/popularClasses", async (req, res) => {
            const result = await coursesCollection.find().sort({ totalStudents: -1 }).limit(6).toArray()
            res.send(result)
        })

        //store selected class to database
        // app.put('/selectedClass', async(req, res) => {
        //     const selectedClass = req.body;
        //     const
        // })

        //get classes added by instructors

        app.get('/courses/:email', async (req, res) => {
            const email = req.params.email
            const query = { 'host.email': email }
            const result = await coursesCollection.find(query).toArray()

            console.log(result)
            res.send(result)
        })

        //store all added course to database

        app.post("/courses", async (req, res) => {
            const courseDetails = req.body;
            const result = await coursesCollection.insertOne(courseDetails)
            res.send(result)
        })

        // delete specific course 
        app.delete("/courses/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await coursesCollection.deleteOne(query)
        })



        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged to MongoDB!");
    }


    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);










app.use('/', (req, res) => {
    res.send('working nicely')
})
app.listen(port, () => {
    console.log(`app is running on port ${port}`)
})