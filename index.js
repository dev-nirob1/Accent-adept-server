const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

// const morgan = require('morgan')
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
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

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    // console.log(authorization)
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
        const paymentsCollection = client.db("accent-adept-DB").collection("payments");

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
            const result = await coursesCollection.find({ approved: true }).sort({classTaken: -1}).limit(6).toArray();
            res.send(result)
        })

        //get single course info
        app.get("/course/details/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await coursesCollection.findOne(query)
            res.send(result)
        })

        // Get selected courses for user from database
        app.get('/selectedCourses', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.query.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access' })
            }
            const filter = { 'userEmail': email };
            const result = await selectedCourseCollection.find(filter).toArray();
            res.send(result);
        });

        //get signle course details selected by users
        app.get('/selectedCourse/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedCourseCollection.findOne(query);
            res.send(result)
        })

        //get courses added by instructors
        app.get('/courses/:email', verifyJWT, verifyInstructor, async (req, res) => {
            const decodedEmail = req.decoded.email;

            const email = req.params.email
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access' })
            }
            const query = { 'host.email': email }
            const result = await coursesCollection.find(query).toArray()
            res.send(result)
        })

        //store selected course to database
        app.post('/selectCourses', verifyJWT, async (req, res) => {
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

        //update course data
        app.patch('/course/updateInfo/:id', async (req, res) => {
            const id = req.params.id;
            const updateCourseInfo = req.body;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    email: updateCourseInfo.email,
                    name: updateCourseInfo.name,
                    className: updateCourseInfo.className,
                    language: updateCourseInfo.language,
                    price: updateCourseInfo.price,
                    ratings: updateCourseInfo.ratings
                }
            }
            const result = await coursesCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        //update course state to approve
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

        //update course state to deny
        app.patch('/course/denied/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    denied: true
                }
            }
            const result = await coursesCollection.updateOne(query, updateDoc, options);
            res.send(result)
        })

        // delete specific course (for instructors)
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
        /******** ********************
        //payment related apis
        ************************************/
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const total = parseInt(price * 100)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: total,
                currency: "usd",
                payment_method_types: [
                    'card'
                ]
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //get all enrolled courses for admin
        app.get('/all-enrolledcourses', async (req, res) => {
            const result = await paymentsCollection.find().toArray();
            res.send(result)
        })

        // Get users enrolled courses added-by instructors from database
        app.get('/enrolledCourse/:email', verifyJWT, verifyInstructor, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access' })
            }
            const filter = { 'added_by': email };
            const result = await paymentsCollection.find(filter).toArray();
            res.send(result);
        });

        //get all enrolled courses for user
        app.get('/enrolledCourses', async (req, res) => {
            const email = req.query.email;
            const query = { 'user_email': email }
            const result = await paymentsCollection.find(query).toArray()
            res.send(result)
        })

        //get payment collection for user
        app.get('/payment-history', async (req, res) => {
            const email = req.query.email;
            const query = { 'user_email': email }
            const result = await paymentsCollection.find(query).toArray()
            res.send(result)
        })

        //payments data added to server

        app.post('/payments', verifyJWT, async (req, res) => {

            const paymentDetails = req.body;

            // Insert payment details into payments collection
            const paymentResult = await paymentsCollection.insertOne(paymentDetails);

            // Delete course from cart after payment
            const query = { _id: new ObjectId(paymentDetails.selectedCourseId) };
            const deleteResult = await selectedCourseCollection.deleteOne(query);

            // Update availableSeats and enrolledStudents in courses collection
            const updateQuery = { _id: new ObjectId(paymentDetails.courseId) };
            const updateFields = {
                $inc: {
                    availableSeats: -1, // Decrease availableSeats by 1
                    enrolledStudents: 1, // Increase enrolledStudents by 1
                },
            };
            const updateResult = await coursesCollection.updateOne(updateQuery, updateFields);

            res.send({ paymentResult, deleteResult, updateResult });
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