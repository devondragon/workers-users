# Email Sending Setup

The **user-mgmt** Worker uses outbound email to send a Password Reset link to support the Password Rest use case. The emailHandler.ts class uses MailChannels, as it is possible to use MailChannels from Cloudflare Workers for free.  If you wish to use another outbound email provider API or SMTP, you can modify or replace the emailHandler class as you wish.

NOTE: The MailChannels free service for Workers ONLY works from Workers and will not work from your local development environment!


There are a few steps you need to take to get successful MailChannels delivery:

1. Setup Domain Lockdown in your DNS
2. Setup DKIM signing
3. Add MailChannels to your SPF record


## Setting up Domain Lockdown
Domain Lockdown is a a DNS TXT record on your domain that verifies to MailChannels that it is allowed to send mail from that domain.

For this example we will assume you are planning to send email From: noreply@mydomain.com, that your Cloudflare Worker is configured under mydomain.com, and that you own the mydomain.com domain.

You create a simple TXT record for your domain, for the hostname:

```
_mailchannels.mydomain.com
```

With the content:
```
v=mc1 cfid=mydomain.com
```

 In theory you could use two different domains, in which case the DNS TXT record would go on the email from domain, and the cfid= would be the domain your Worker runs under.

 If you are running the Worker under the default Cloudflare Dev env, you can use "cfid=myapp.workers.dev" with the value being the correct one for your Worker.


 ## Setting up DKIM with MailChannels

 ### Create DKIM Keys

There are tons of guides on this online. Here is a simple set of commands that will work on a MacOS or Linux command line:

```bash
openssl genrsa 2048 | tee priv_key.pem | openssl rsa -outform der | openssl base64 -A > priv_key.txt\n
```

This generates a private key and stores it in PEM and Base64 encoded text formats.

```bash
echo -n "v=DKIM1;p=" > pub_key_record.txt && \\nopenssl rsa -in priv_key.pem -pubout -outform der | openssl base64 -A >> pub_key_record.txt\n
```

This generates a public key from the private key and also creates a text file with the full contents for a DKIM TXT DNS record.

The contents of priv_key.txt, the Base64 encoded private key, will be used later in this section as a configuration value for the Worker.

The contents of the pub_key_record.txt will be used in the next step, creating the DKIM DNS record.



### Set Public Key in DNS

For your sending domain, the domain your From address will be on your outbound emails, you'll need to setup a DKIM record in your DNS. You can have multiple DKIM records for your domain, each with a different selector.  So for this one you'll create a TXT record with a name/domain that looks like this:

```
mailchainnels._domainkey.mydomain.com
```

Then you'll set the content/value to the contents of the pub_key_record.txt file that was created in the previous step.  This will look like "v=DKIM1;p=....."


### Configure Worker

This Worker uses three configuration values to enable DKIM signing while sending through MailChannels. Two of them can be set in the wrangler.toml, but the DKIM private key is a secret and it is better practice to save it as a Secret in your Cloudflare Worker environment using either the Dashboard or the Wrangler command line tool.

[Read about setting Cloudflare Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)


Here are the three variables:

```
EMAIL_DKIM_SELECTOR = "mailchannels"
EMAIL_DKIM_DOMAIN = "mydomain.com"
EMAIL_DKIM_PRIVATE_KEY = "Your Base64 Encoded Private Key. This should be kept SECRET!"
```

The EMAIL_DKIM_SELECTOR value should NOT include the "_domainkey" part, just the part that preceeds that.

The EMAIL_DKIM_DOMAIN should be your root domain name.

The EMAIL_DKIM_PRIVATE_KEY should NOT be set in your wrangler.toml file, but instead should be set through the Cloudflare Dashboard or Wrangler tool using directions in the Secrets webpage linked to above.  The contents should be the contents of the priv_key.txt file created above.



## Add MailChannels to your SPF Record
Add the following to the SPF Record for the domain you will using for your From address:

```
include:relay.mailchannels.net
```


## Configure Sending Email Address

You will need to configure the From email address and Name for the outbound emails used in the Forgot Password flow.  They are variables that can be configured in the wrangler.toml file:

```
EMAIL_FROM = "noreply@mydomain.com"
EMAIL_FROM_NAME = "My Wonderful Website"
```



## Summary

Once all the above is done, you should be able to send emails as part of the Forgot Password flow using MailChannels, without needing to sign up for a MailChannels account or pay anything.

Remember, you can only send the emails from the Worker deployed in Cloudflare, and it will not work when running locally.

If you run into any issues, you can check the logs of the **user-mgmt** Worker when you execute the Forgot Password flow, and you should see any error response from the MailChannels API.

HUGE thanks to MailChannels for allowing us to use their service like this!



## Reference Links
[MailChannels Cloudflare Setup Guide](https://support.mailchannels.com/hc/en-us/articles/4565898358413-Sending-Email-from-Cloudflare-Workers-using-MailChannels-Send-API)

[Domain Lockdown Guide](https://support.mailchannels.com/hc/en-us/articles/16918954360845-Secure-your-domain-name-against-spoofing-with-Domain-Lockdown)
[MailChannels SPF Setup Guide](https://support.mailchannels.com/hc/en-us/articles/200262610-Set-up-SPF-Records)
