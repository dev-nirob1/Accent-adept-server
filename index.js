const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
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

const verifyJWT = async (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' })
    }
    const token = authorization.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: 'Unauthorized access' })
        }
        req.decoded = decoded;
        next()
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        const coursesCollection = client.db("accent-adept-DB").collection("courses");
        const usersCollection = client.db("accent-adept-DB").collection("users")
        const selectedCourseCollection = client.db("accent-adept-DB").collection("selectedCourse")

        //verify admin middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next()
        }

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next()
        }

        //genarate jwt token
        app.post('/jwt', (req, res) => {
            const email = req.body;
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
            // console.log(token)
            res.send({ token })
        })

        /****************************************************************************************
        *********************************** users related apis***********************************/

        // users related api
        app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        //find specific user role
        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query)
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
            // console.log(result)
            res.send(result)
        })

        //update user role to admin 
        app.patch('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
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
        app.patch('/users/instructor/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        // delete a user from database
        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })

        /****************************************************************************************
         *********************************** course related apis***********************************/

        //get all courses from database
        app.get('/courses', async (req, res) => {
            const result = await coursesCollection.find().toArray();
            res.send(result);
        });

        // instructors page api 
        app.get("/instructors", async (req, res) => {
            const result = await coursesCollection.find({ approved: true }).toArray()
            res.send(result)
        })

        //classes api
        app.get("/classes", async (req, res) => {
            const result = await coursesCollection.find({ approved: true }).toArray()
            res.send(result)
        })

        // top 6 most popular classes based on total students
        app.get("/popularClasses", async (req, res) => {
            const result = await coursesCollection.find({ approved: true }).sort({ totalStudents: -1 }).limit(6).toArray()
            res.send(result)
        })

        // top 6 most popular instrutors 
        app.get("/popularInstructors", async (req, res) => {
            const result = await coursesCollection.find({ approved: true }).limit(6).toArray();
            res.send(result)
        })

        //get single course info
        app.get("/course/details/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await coursesCollection.findOne(query)
            res.send(result)
        })

        // Get selected courses for user from database
        app.get('/selectedCourses', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.query.email;
            console.log(email);
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access' })
            }
            const filter = { 'userEmail': email };
            const result = await selectedCourseCollection.find(filter).toArray();
            res.send(result);
        });

        //get signle course details selected by users
        app.get('/selectedCourse/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedCourseCollection.findOne(query);
            res.send(result)
        })

        // Get selected instructors courses by user from database
        app.get('/selectedCourses/:email', verifyJWT, verifyInstructor, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;
            // console.log(email);
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access' })
            }
            const filter = { 'hostEmail': email };
            const result = await selectedCourseCollection.find(filter).toArray();
            res.send(result);
        });

        //get courses added by instructors
        app.get('/courses/:email', verifyJWT, verifyInstructor, async (req, res) => {
            const decodedEmail = req.decoded.email;
            // console.log(decodedEmail)
            const email = req.params.email
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access' })
            }
            const query = { 'host.email': email }
            const result = await coursesCollection.find(query).toArray()
            // console.log(result)
            res.send(result)
        })

        //store selected course to database
        app.post('/selectCourses', async (req, res) => {
            const selectCourse = req.body;
            const result = await selectedCourseCollection.insertOne(selectCourse)
            res.send(result)
        })

        //store all added course to database
        app.post("/courses", verifyJWT, verifyInstructor, async (req, res) => {
            const courseDetails = req.body;
            const result = await coursesCollection.insertOne(courseDetails)
            res.send(result)
        })

        //update course state
        app.patch('/course/updateState/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    approved: true
                }
            }
            const result = await coursesCollection.updateOne(query, updateDoc, options);
            res.send(result)
        })

        // delete specific course 
        app.delete("/courses/:id", verifyJWT, verifyInstructor, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await coursesCollection.deleteOne(query)
            res.send(result)
        })

        // delete specific selected course 
        app.delete("/selectedCourse/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedCourseCollection.deleteOne(query)
            res.send(result)
        })

        //payment related apis
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const total = parseInt(price * 100)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: total,
                currency: "usd",
                payment_Method_Types: [
                    'card'
                ]
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
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