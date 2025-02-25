const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();

const db = admin.firestore();

// Access the SendGrid API key from Firebase config
const sendGridApiKey = process.env.SENDGRID;

// Set the API key for SendGrid
sgMail.setApiKey(sendGridApiKey);

// On Request Call Function
exports.sendVerificationCode = onRequest({ cors: true }, (request, response) => {

    let email = request.query.email;

    // Check to make sure parameters present
    if (!email) {
        response.send("{Status: 100, Message: Invalid Request}");
    } else {
        // Generate a random 5-digit code
        const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();

        // Set code expiration (10 minutes from now)
        const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));

        // Check if user exists within database
        admin.auth().getUserByEmail(email)
        .then((userRecord) => {
            if (userRecord) {
                var userData = userRecord.toJSON();

                // If user isn't verified then send email and set code
                if (userData.emailVerified == false) {
                    db.collection('codes').doc(userData.uid).set({
                        code: verificationCode,
                        expiresAt
                    });

                    // Send email with the verification code
                    const msg = {
                        to: email, 
                        from: "accounts@unishare.app",
                        subject: "Your UniShare Verification Code",
                        templateId: "d-8fb9e4c2e07f45ac861ec2ae7ae586ad",
                        dynamicTemplateData: {
                            code: verificationCode,
                        },
                    };

                    sgMail.send(msg)
                    .then(function() {
                        response.send("{Status: 200, Message: Verification Sent}");
                    }).catch(function(error) {
                        response.send(error);
                    });
                } else {
                    // If doc exists but user is verified then return
                    response.send("{Status: 300, Message: User Already Verified}");
                }
            }
        })
        .catch(function() {
            response.send("{Status: 400, Message: No User Exists With That Email}");
        });
    }
});

exports.checkVerificationCode = onRequest({ cors: true }, (request, response) => {

    let email = request.query.email;
    let userid = request.query.userid;
    let codeInput = request.query.code;

    // Check if parameters are present
    if (!email || !userid || !codeInput) {
        response.send("{Status: 100, Message: Invalid Request}");
    } else {
        // Get user document
        db.collection("codes").doc(userid).get().then((doc) => {
            if (!doc.exists) {
                response.send("{Status: 200, Message: Verification Code Doesn't Exist}");
            } else {

                const { code, expiresAt } = doc.data();
                const now = new Date();

                // Check if user code is expired
                if (now > expiresAt.toDate()) {
                    response.send("{Status: 300, Message: Verification Code Expired}");
                } else {
                    // Check if user is verified
                    admin.auth().getUserByEmail(email)
                    .then((userRecord) => {
                        var userData = userRecord.toJSON();
                        if (userData.emailVerified == true) {
                            response.send("{Status: 400, Message: Email Already Verified}");
                        } else {
                            // Check if code is correct
                            if (codeInput === code) {
                                // Update user email verification
                                admin.auth().updateUser(userid, { emailVerified: true })
                                .then((userRecord) => {
                                    var userData = userRecord.toJSON();

                                    // Update Firestore verification status
                                    db.collection("codes").doc(userid).delete()
                                    .then(() => {
                                        // Send email
                                        const msg = {
                                            to: email, 
                                            from: "accounts@unishare.app",
                                            subject: "Welcome to UniShare!",
                                            templateId: "d-90a5e5fcf06c460e9d899fb879642632",
                                            dynamicTemplateData: {
                                                name: userData.displayName,
                                            },
                                        };

                                        sgMail.send(msg)
                                        .then(function() {
                                            response.send("{Status: 500, Message: Account Verified}");
                                        });
                                    }).catch(function(error) {
                                        response.send(error);
                                    });
                                })
                                .catch((error) => {
                                    response.send(error);
                                });

                            } else {
                                response.send("{Status: 600, Message: Invalid Verification Code}");
                            }
                        }
                    }).catch(function(error) {
                        response.send("{Status: 700, Message: No User Exists With That Email}");
                    });
                }
            }
        });
    }
});
