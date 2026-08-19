//validates format and email domain

//It lets your backend look up information about internet domains.
//.promises allows you to use await.
const dns = require("node:dns").promises;
//This checks whether the email has a basic valid structure:
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//rawEmail means the original email received from the frontend.
const validateEmailForOtp = async(rawEmail)=>{
    //Checks whether the submitted value is text.
    if(typeof rawEmail !== "string"){
        return {status: "invalid-format"};
    }
    const email = rawEmail.trim().toLowerCase()
//.test(email) checks the email against the regular expression.
    if(!emailPattern.test(email)){
        return {status:"invalid-format"}
    }

    const domain = email.split("@")[1];
    try{
    // resolveMx() searches for mail severs connected to the domain
    // await waits for the result
    const records = await dns.resolveMx(domain);
    // .some() checks whether at least one item passes the test
    const hasWorkingMx = records.some(
        // checking: record.exchange contains a mail-server address, The address is not "." << is a special value meaning the domain intentionally does not receive email.
        (record) => record.exchange && record.exchange !== "."
    )
    // return the domain result
    return{
        //Mx is true, return valid, otherwise return invalid-domain
        status: hasWorkingMx? "valid" : "invalid-domain",
        email
    }
    }catch(error){
        //ENOTFOUND: normally means the domain does not exist.
        if(error.code === "ENOTFOUND"){
            return{
                status:"invalid-domain",
                email
            }
        }
        //ENODATA:  means the domain exists, but Node could not find an MX record.
        if(error.code === "ENODATA"){
            //Promise.allSettled() runs multiple asynchronous operations and waits for all of them.
            const results = await Promise.allSettled([
                //Looks for an IPv4 address.
                dns.resolve4(domain),
                //Looks for an IPv6 address.
                dns.resolve6(domain),
            ])
            // check whether an IP was found
            const hasAddress = results.some(
                (result)=>
                // check whether at least one lookup succeeded
                //Means that the lookup completed successfully.
                    result.status == "fulfilled" && 
                    result.value.length > 0
            )
            return {
                status: hasAddress ? "possible":"invalid-domain",
                email,
            }
        }
        console.error("Email DNS validation failed:",error.code)

        return{
            status:"unknown",
            email
        }
    }
}

module.exports = validateEmailForOtp