const scriptInfo = {
  script: "Flair FreeAgent v6",
  version: "2.0 21st April"
};

const testData = {
  parameter: {
    action: "downloadFAattachment" // Specify the action for testing
  },
  postData: {
    contents: JSON.stringify({ userId: "QEGh.5w1Qkuf2CsiqhJIiw",url:"https://api.freeagent.com/v2/attachments/58375009" }) //
  }
};

// FreeAgent API credentials
const CLIENT_ID = "zuxi8u0FsSEAN5yuDPhB-g";
const CLIENT_SECRET = "j91JIFWm8DmGGub7FXK91w";
const REDIRECT_URI = "https://script.google.com/macros/s/AKfycbxRZDfC56kNOgXvU6jY74cP1qqYI0eua_fcG7JPIF8iS3LeTJQ107YddOtkwT9jvVFC8g/exec";

// Glide API credentials
const GLIDE_API_TOKEN = "c5389e75-ed50-4e6c-b61d-3d94bfe8deaa";
const GLIDE_APP_ID = "UbT1xymHQQ1z7AKL0Z3v";
const GLIDE_TABLE_NAME = "native-table-qQtBfW3I3zbQYJd4b3oF"; // Replace with your actual table name


function doTest() {  
    // Call doPost directly and log the output
    const response = doPost(testData);
  }


  function doPost(e) {
    // Detect if this is test mode based on the absence of 'type' in postData
    const isTestMode = !e.postData || !e.postData.type;
  
    // Validate API key received from Glide. Skip validation if in test mode
    if (!isTestMode) {
      const validationResponse = validateApiKey(e);
      if (validationResponse) return validationResponse;
    }
  
    try {
      logMessage("INFO", isTestMode ? "Test Mode" : "API Call");
  
      // Get the 'action' parameter
      const action = e.parameter.action;
      if (!action) throw new Error("Missing 'action' parameter in query string.");
      console.log(action);
  
      // Parse POST data
      let requestData = isTestMode 
        ? JSON.parse(e.postData.contents || '{}') 
        : e.postData?.contents 
          ? JSON.parse(e.postData.contents) 
          : null;
      
      if (!requestData) throw new Error("Missing or invalid POST data.");
  
      // Extract user ID and get token
      const userId = requestData.userId;
      const token = getAccessToken(userId);
  
      // Dispatch to the correct function based on action
      switch (action) {
        case "getInfo":
          logMessage("INFO", "Running Get Info");
          return ContentService.createTextOutput(getInfo(token).getContent())
            .setMimeType(ContentService.MimeType.JSON);
  
        case "getTransactions":
          if (!requestData.bankAccount) 
            throw new Error("Missing 'bankAccount' in request data.");
          logMessage("INFO", "Running Get Transactions");
          return ContentService.createTextOutput(
            getTransactions(token, requestData.bankAccount).getContent()
          ).setMimeType(ContentService.MimeType.JSON);
  
        case "addExpense":
          logMessage("INFO", "Adding an expense");
          const expenseResult = addExpense(token, requestData);
          return createApiResponse(
            expenseResult.success, 
            expenseResult.message, 
            expenseResult.success ? expenseResult : expenseResult.details
          );
  
        case "attachReceipt":
          logMessage("INFO", "Attaching a receipt");
          const attachResult = attachReceipt(token, requestData);
          return createApiResponse(
            true, 
            "Receipt attached to FreeAgent transaction", 
            attachResult
          );
  
        case "downloadFAattachment":
          logMessage("INFO", "Downloading FA Attachment");
          const downloadResult = downloadFAAttachment(token, requestData);
          return createApiResponse(
            downloadResult.success, 
            downloadResult.message, 
            downloadResult.success ? downloadResult.url : downloadResult.details
          );
  
        case "deleteExplanation":
          logMessage("INFO", "Deleting explanation");
          const deleteResult = deleteExplanation(token, requestData);
          return createApiResponse(true, "Explanation removed", deleteResult);
  
        default:
          throw new Error(`Invalid action: ${action}`);
      }
    } catch (error) {
      // Handle errors and return an appropriate response
      logMessage("ERROR", error.message);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: error.message })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  
  //$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
  
  function doPostOLD(e) {
  
    // Detect if this is test mode based on the absence of 'type' in postData
    const isTestMode = !e.postData || !e.postData.type;
  
  // Validate API key received from Glide. Skip if in test mode
  if (!isTestMode) {
    const validationResponse = validateApiKey(e); // Call the function
    if (validationResponse) {
      return validationResponse; // Return error response if invalid
    }
  }
  
    try {
      logMessage("Info", isTestMode ? "Test Mode" : "API Call");
      // Get action parameter
      const action = e.parameter.action; // No need for the ternary operator!
      if (!action) {
        throw new Error("Missing 'action' parameter in query string.");
      }
  
      console.log(action);
  
      //Get POST data
      let requestData;
      if (isTestMode) {
        requestData = JSON.parse(e.postData.contents);
      } else {
        if (e.postData && e.postData.contents) {
          requestData = JSON.parse(e.postData.contents);
        } else {
          throw new Error("Missing or invalid POST data.");
        }
      }
  
      //Validate data and get token
      const userId = requestData.userId;
      const token = getAccessToken(userId);
  
      // Dispatch to the correct function based on action
      let result;
      switch (action) {
        case "getInfo":
          result = getInfo(token);
          logMessage("INFO", "Running Get Info");
          return ContentService.createTextOutput(result.getContent())
            .setMimeType(ContentService.MimeType.JSON);
          break;
  
        case "getTransactions":
          if (!requestData.bankAccount) {
            throw new Error("Missing 'bankAccount' in request data.");
          }
          const bankAccount = requestData.bankAccount; // Guaranteed to be valid
          logMessage("INFO", "Running Get Transactions");
          result = getTransactions(token, bankAccount);
          return ContentService.createTextOutput(result.getContent())
            .setMimeType(ContentService.MimeType.JSON);
          break;
  
        case "addExpense":
          logMessage("INFO", "Adding an expense");
          result = addExpense(token, requestData);
          if (result.success) {
            return createApiResponse(true, result.message, result);
            } else {
            return createApiResponse(false, result.message, result.details);
            }
          break;
  
        case "attachReceipt":
          result = attachReceipt(token, requestData);
          return createApiResponse(true, "Receipt attached to FreeAgent transaction", result);
          break;
  
        case "downloadFAattachment" :
          console.log("Downloading FA Attachment");
          result = downloadFAAttachment(token, requestData);
          if (result.success) {
            return createApiResponse(true, result.message, result.url);
            } else {
            return createApiResponse(false, result.message, result.details);
            }
  
        case "deleteExplanation":
          result = deleteExplanation(token, requestData);
          return createApiResponse(true, "Explanation removed", result);
  
        default:
          console.log("No valid action");
          throw new Error(`Invalid action: ${action}`);
      }
  
    } catch (error) {
  
      // Return error response
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: error.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  

  //DoGet handles the Admin Dashboard and the initial response back from FreeAgent

function doGet(e) {
    try {
      if (e.parameter.code && e.parameter.state) {
        // Handle OAuth2 Redirect from FreeAgent
        logMessage("INFO", "Exchanging access code for token.");
        return handleFreeAgentRedirect(e);
      }
  
      if (e.parameter.admin === "true") {
        // Serve Admin Dashboard
        //logMessage("INFO","Serving webpage");
        return serveAdminDashboard();
      }
  
      // Default response for invalid requests
      return HtmlService.createHtmlOutput("<h1>Error</h1><p>Invalid request. Missing required parameters.</p>");
    } catch (error) {
      logMessage("ERROR", error.message);
      return HtmlService.createHtmlOutput("<h1>Error</h1><p>Unexpected error occurred. Check logs.</p>");
    }
  }
  
  ///Work with FreeAgent initial response
  function handleFreeAgentRedirect(e) {
    const properties = PropertiesService.getScriptProperties();
    const code = e.parameter.code;
    const userId = e.parameter.state;
  
    // Exchange code for token
    const tokenResponse = exchangeCodeForToken(code);
    if (!tokenResponse) {
      return HtmlService.createHtmlOutput("<h1>Error</h1><p>Failed to exchange code for token. Please try again.</p>");
    }
  
    // Store tokens in script properties
    properties.setProperty(userId, JSON.stringify({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_in: tokenResponse.expires_in,
      timestamp: new Date().toISOString()
    }));
  
    // Update Glide with authentication status
    const glideMessage = "Authenticated";
    const glideResponse = writeToGlide(userId, new Date().toISOString(), glideMessage);
    logMessage("INFO", "Glide API Response: " + JSON.stringify(glideResponse));
  
    // Redirect back to the app
    return redirectHTML("https://receipts.flair.london");
  }
  
  //Serve Admin Dashboard
  function serveAdminDashboard() {
    const properties = PropertiesService.getScriptProperties();
  
    // Filter out unwanted keys (e.g., GLOBAL)
    const filteredProperties = Object.fromEntries(
      Object.entries(properties.getProperties()).filter(([key]) => key !== "GLOBAL")
    );
  
    const template = HtmlService.createTemplateFromFile('adminDashboard');
  
    // Process the filtered properties
    const userProperties = Object.keys(filteredProperties)
      .filter(key => key !== "LAST_API_RESPONSE") // Exclude more keys if needed
      .reduce((acc, key) => {
        try {
          acc[key] = JSON.parse(filteredProperties[key]); // Safely parse JSON
        } catch (e) {
          acc[key] = filteredProperties[key]; // Fallback for plain text
        }
        return acc;
      }, {});
  
    // Pass properties and version to template
    template.properties = userProperties;
    template.version = scriptInfo.version; // Pass the version
  
    return template
      .evaluate()
      .setTitle('Flair Admin Dashboard')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  }
  
  
  //Exchange Oauth code for token
  function exchangeCodeForToken(code) {
    const tokenUrl = "https://api.freeagent.com/v2/token_endpoint";
  
    const payload = {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    };
  
    const options = {
      method: "POST",
      payload: payload
    };
  
    try {
      const response = UrlFetchApp.fetch(tokenUrl, options);
      return JSON.parse(response.getContentText());
    } catch (error) {
      logMessage("ERROR", "Failed to exchange token: " + error.message);
      return null;
    }
  }
  
  
  //Write to Glide table
  function writeToGlide(userId, timestamp, message) {
    const glideUrl = `https://api.glideapps.com/apps/${GLIDE_APP_ID}/tables/${GLIDE_TABLE_NAME}/rows/${userId}`;
    const payload = {
      "api-write/timestamp": timestamp,
      "api-write/message": message
    };
  
    const options = {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GLIDE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
    };
  
    try {
      const response = UrlFetchApp.fetch(glideUrl, options);
      return JSON.parse(response.getContentText());
    } catch (error) {
      logMessage("ERROR", "Failed to write to Glide table: " + error.message);
      return { success: false, error: error.message };
    }
  }
  
  // Generates an HTML response to redirect users
  function redirectHTML(url) {
    return HtmlService.createHtmlOutput(`
      <html>
        <head><title>Redirecting...</title></head>
        <body>
          <script>
            window.open("${url}", "_blank");
            window.close();
          </script>
          <p>You are being redirected. <a href="${url}" target="_blank">Click here</a> if nothing happens.</p>
        </body>
      </html>
    `);
  }


  <!DOCTYPE html>
<html>
<head>
  <title>Flair Receipts and Expenses Admin Dashboard</title>
</head>
<body>
  <h1>Flair Receipts and Expenses Admin Dashboard</h1>
  <p>This dashboard displays the current token details for each user.</p>

  <h3>Version: <span id="version"><?= version ?></span></h3>

  <h3>Stored Tokens:</h3>
  <table border="1" style="border-collapse: collapse; width: 100%;">
    <thead>
      <tr>
        <th>User ID</th>
        <th>Access Token</th>
        <th>Refresh Token</th>
        <th>Expires In (seconds)</th>
        <th>Relative Expiry</th>
        <th>Issued At</th>
      </tr>
    </thead>
    <tbody>
      <? for (let key in properties) { 
        let data = properties[key];

        // Parse ISO 8601 timestamp to Unix time (seconds)
        let issued_at = Math.floor(new Date(data.timestamp).getTime() / 1000); // Convert to seconds
        let now = Math.floor(Date.now() / 1000); // Current time in seconds

        // Calculate expiry time and remaining time
        let expires_at = issued_at + data.expires_in; // Expiry time in seconds
        let time_left = expires_at - now;

        // Generate human-readable relative time
        let relative_time;
        if (time_left < 0) {
          relative_time = "Expired";
        } else if (time_left < 60) {
          relative_time = "In less than a minute";
        } else if (time_left < 3600) {
          relative_time = `In ${Math.floor(time_left / 60)} minutes`;
        } else if (time_left < 86400) {
          relative_time = `In ${Math.floor(time_left / 3600)} hours`;
        } else {
          relative_time = `In ${Math.floor(time_left / 86400)} days`;
        }
      ?>
        <tr>
          <td><?= key ?></td>
          <!--<td><?= data.access_token ?></td>-->
          <td>Access Token Hidden</td>
          <td>Refresh Token Hidden</td>
          <!--<td><?= data.refresh_token ?></td>-->
          <td><?= data.expires_in ?></td>
          <td><?= relative_time ?></td>
          <td><?= data.timestamp ?></td>
        </tr>
      <? } ?>
    </tbody>
  </table>

</body>
</html>


// Fetch general FreeAgent info
function getInfo(accessToken) {
    logMessage("INFO","Doing Get getInfo");
      try {
        const responses = {
          company: fetchFreeAgentData("https://api.freeagent.com/v2/company", accessToken),
          user: fetchFreeAgentData("https://api.freeagent.com/v2/users/me", accessToken),
          categories: fetchFreeAgentData("https://api.freeagent.com/v2/categories", accessToken),
          bank_accounts: fetchFreeAgentData("https://api.freeagent.com/v2/bank_accounts", accessToken),
          projects: fetchFreeAgentData("https://api.freeagent.com/v2/projects?view=active", accessToken),
        };
        return createApiResponse(true, "Fetched FreeAgent info successfully", responses);
      } catch (error) {
        console.error("Error in getInfo: " + error.message);
        return createApiResponse(false, "Failed to fetch FreeAgent info", error.message);
      }
    }
    
    //Get transactions
    function getTransactions(accessToken, bankAccount) {
      try {
        const apiUrlBankTransactions = `https://api.freeagent.com/v2/bank_transactions?bank_account=${bankAccount}&per_page=100`;
        const transactionData = fetchFreeAgentData(apiUrlBankTransactions,accessToken,);
        return createApiResponse(true, "Fetched FreeAgent info successfully", transactionData);
    
    
      } catch (error) {
        console.error("Error in get transactions: " + error.message);
        return createApiResponse(false, "Failed to get transactions", error.message);
      }
     
    }
    
    // Fetch data from FreeAgent
    function fetchFreeAgentData(url, accessToken) {
      const options = {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };
    
      try {
        const response = UrlFetchApp.fetch(url, options);
        return JSON.parse(response.getContentText());
      } catch (error) {
        console.error(`Failed to fetch data from ${url}: ` + error.message);
        throw new Error(`Failed to fetch data from ${url}: ${error.message}`);
      }
    }

    
    // Add a new expense
function addExpenseOLD(accessToken, requestData) {
    try {
      // Encode the attachment
      const base64encodedUrl = downloadAndEncodeBase64(requestData.expense.attachment);
  
      // Prepare the payload
      const payload = {
        expense: {
          user: requestData.expense.user,
          description: requestData.expense.description,
          category: requestData.expense.category,
          gross_value: requestData.expense.gross_value,
          dated_on: requestData.expense.dated_on,
          attachment: {
            data: base64encodedUrl.data,
            content_type: base64encodedUrl.content_type,
            file_name: base64encodedUrl.file_name
          }
        }
      };
  
      // Configure HTTP request options
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        },
        muteHttpExceptions: true,
        payload: JSON.stringify(payload)
      };
  
      // Make the HTTP POST request
      const response = UrlFetchApp.fetch("https://api.freeagent.com/v2/expenses", options);
      const parsedResponseBody = JSON.parse(response.getContentText());
      if (response.getResponseCode() === 201) {
        logMessage("INFO", "Expense added", parsedResponseBody);
        return { success: true, message: "Added to FreeAgent as an expense" };
      } else {
        logMessage("ERROR", "Error adding expense - parsedResponseBody = ", JSON.stringify(parsedResponseBody, null, 2));
        return { success: false, message: "Error adding expense", details: parsedResponseBody };
      }
  
    } catch (error) {
      logMessage("ERROR", "Error adding expense - response = ", JSON.stringify(error, null, 2));
      return { success: false, message: "Unexpected error occurred", details: error };
    }
  }
  
  // Add a new expense
  function addExpense(accessToken, requestData) {
    try {
      // Encode the attachment
      //const base64encodedUrl = downloadAndEncodeBase64(requestData.expense.attachment); OLD EXPENSE STATEMENT
      const base64encodedUrl = requestData.expense.attachment ? downloadAndEncodeBase64(requestData.expense.attachment):null;
  //    let base64encodedUrl = requestData.attachment ? downloadAndEncodeBase64(requestData.attachment) : null; ADD TO TRANSACTION STATEMENT
  
      // Handle htmlBody conversion to Base64 if provided
      let base64HtmlData = requestData.expense.htmlBody ? convertHtmlToBase64(requestData.expense.htmlBody) : null;
  
      // Prepare the payload
      const payload = {
        expense: {
          user: requestData.expense.user,
          description: requestData.expense.description,
          category: requestData.expense.category,
          gross_value: requestData.expense.gross_value,
          dated_on: requestData.expense.dated_on,
          attachment: requestData.expense.attachment
          ? {
            data: base64encodedUrl.data,
            content_type: base64encodedUrl.content_type,
            file_name: base64encodedUrl.file_name
          }
          : base64HtmlData
               ? {
                 data: base64HtmlData.data,
                 content_type: 'text/html',
                 file_name: 'attachment.html'
               }
               : null,
        }
      };
  
  
  
      // Configure HTTP request options
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        },
        muteHttpExceptions: true,
        payload: JSON.stringify(payload)
      };
  
      // Make the HTTP POST request
      const response = UrlFetchApp.fetch("https://api.freeagent.com/v2/expenses", options);
      const parsedResponseBody = JSON.parse(response.getContentText());
      if (response.getResponseCode() === 201) {
        logMessage("INFO", "Expense added", parsedResponseBody);
        return { success: true, message: "Added to FreeAgent as an expense" };
      } else {
        logMessage("ERROR", "Error adding expense - parsedResponseBody = ", JSON.stringify(parsedResponseBody, null, 2));
        return { success: false, message: "Error adding expense", details: parsedResponseBody };
      }
  
    } catch (error) {
      logMessage("ERROR", "Error adding expense - response = ", JSON.stringify(error, null, 2));
      return { success: false, message: "Unexpected error occurred", details: error };
    }
  }


  function attachReceipt(accessToken, requestData) {
    // Check if explanationUrl exists in the JSON
    if (requestData.explanationUrl) {
      // Extract the ID from the explanationUrl, construct DELETE endpoint set up options
      const explanationId = requestData.explanationUrl.split('/').pop();
      const deleteUrl = `https://api.freeagent.com/v2/bank_transaction_explanations/${explanationId}`;
      const deleteOptions = {
        method: 'delete',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        muteHttpExceptions: true
      };
  
      // Perform DELETE request
      const deleteResponse = UrlFetchApp.fetch(deleteUrl, deleteOptions);
      const deleteStatusCode = deleteResponse.getResponseCode();
  
      // Check if successful
      if (deleteStatusCode !== 204 && deleteStatusCode !== 200) {
        logMessage("ERROR", "Failed to delete explanation (Function attachReceipt)", deleteStatusCode);
        return; // Stop execution if delete fails
      }
    } else {
      logMessage("INFO", "No existing explanation - no deletion necessary.");
    }
  
    // Now create the new bank transaction explanation
    try {
      // Construct the POST endpoint URL
      const postUrl = 'https://api.freeagent.com/v2/bank_transaction_explanations';
  
      // Encode the file provided as a URL into base64 if there's an attachment
      let base64encodedUrl = requestData.attachment ? downloadAndEncodeBase64(requestData.attachment) : null;
  
      // Handle htmlBody conversion to Base64 if provided
      let base64HtmlData = requestData.htmlBody ? convertHtmlToBase64(requestData.htmlBody) : null;
  
      // Build the payload
      const payload = {
        bank_transaction_explanation: {
          bank_transaction: requestData.bankTransactionUrl,
          dated_on: requestData.dated_on,
          description: requestData.description,
          gross_value: requestData.gross_value,
          category: requestData.category,
          project: requestData.project,
          rebill_type: requestData.rebill_type,
          rebill_factor: requestData.rebill_factor,
          sales_tax_rate: requestData.sales_tax_rate,
          attachment: requestData.attachment
            ? {
                data: base64encodedUrl.data,
                content_type: base64encodedUrl.content_type,
                file_name: base64encodedUrl.file_name
              }
            : base64HtmlData
            ? {
                data: base64HtmlData.data,
                content_type: 'text/html',
                file_name: 'attachment.html'
              }
            : null,
        }
      };
  
      // Set up the request options for POST
      const postOptions = {
        method: 'post',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
  
      // Perform POST request
      const postResponse = UrlFetchApp.fetch(postUrl, postOptions);
  
      logMessage("INFO", "Receipt attached to FreeAgent transaction", postResponse.getContentText());
      return postResponse;
  
    } catch (error) {
      logMessage("ERROR", "Error creating explanation", error.message);
    }
  }
  
  // Placeholder function for converting HTML to Base64
  function convertHtmlToBase64(htmlBody) {
    logMessage("Info","Encoding HTML to base64");
    return {
      data: Utilities.base64Encode(htmlBody),
      content_type: 'text/html'
    };
  }


  function deleteExplanation(accessToken, requestData) {
    // Log the URL being used for deletion
    logMessage("Info", "Delete explanation", requestData.explanationUrl);
  
    // Make the DELETE request
    var options = {
      method: "delete", // HTTP method
      headers: {
        Authorization: "Bearer " + accessToken, // Add Authorization header
        "Content-Type": "application/json" // Specify content type
      },
      muteHttpExceptions: true // Prevent errors from throwing exceptions
    };
  
    try {
      // Send the DELETE request
      var response = UrlFetchApp.fetch(requestData.explanationUrl, options);
      var statusCode = response.getResponseCode(); // Get HTTP response code
  
      // Check if the deletion was successful
      if (statusCode === 204) {
        logMessage("Success", "Explanation deleted successfully", requestData.explanationUrl);
        return createApiResponse(true, "Explanation deleted successfully");
      } else {
        logMessage("Error", "Failed to delete explanation", response.getContentText());
      }
    } catch (error) {
      logMessage("Error", "Exception during deletion", error.toString());
    }
  }




//Global functions

function validateApiKey(request) {
  const properties = PropertiesService.getScriptProperties();
  const storedApiKey = JSON.parse(properties.getProperty("GLOBAL")).api_key; // Retrieve the stored key

  // Get the API key sent in the request body
  const body = JSON.parse(request.postData.contents || '{}'); // Default to empty object if parsing fails
  const receivedApiKey = body.api_key;

  // Check if the key matches
  if (receivedApiKey !== storedApiKey) {
    return ContentService.createTextOutput(JSON.stringify({
      info: {
        success: false,
        timestamp: new Date().toISOString(),
        message: "Invalid API key"
      }
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Return null for success (no output needed here)
  return null; // Key is valid
}

function logMessage(level, message, extra = {}) {
  // Combine metadata with custom fields
  console.log({
    ...scriptInfo,         // Include script metadata
    level: level.toUpperCase(), // INFO, ERROR, etc.
    message: message,         // Main log message
    extra,                  // Any extra fields
    timestamp: new Date().toISOString() // Always include a timestamp
  });
}

//A function to download a file from a URL and encode it to base64
function downloadAndEncodeBase64(attachmentUrl) {
  try {
    // Fetch the file from the given URL
    const response = UrlFetchApp.fetch(attachmentUrl, { muteHttpExceptions: true });

    // Get the binary data
    const blob = response.getBlob();

    // Encode the file to Base64
    const base64Data = Utilities.base64Encode(blob.getBytes());

    // Extract the content type
    const contentType = blob.getContentType();

    // Extract the file name
    const fileName = blob.getName() || attachmentUrl.split('/').pop(); // Use the URL's last part as fallback

    //Get the file size
    const fileSizeMb = (blob.getBytes().length / (1024 * 1024)).toFixed(2);

    //const fileInfo = "Content Type = " + contentType + " Filename = " + fileName;
    fileInfo = `Content Type = ${contentType}, Filename = ${fileName}, Size in MB = ${fileSizeMb}`;
    logMessage("Info", "file encoded to base64 successfully", fileInfo);


    // Return an object with all required data
    return {
      data: base64Data,
      content_type: contentType,
      file_name: fileName,
      file_size: fileSizeMb
    };

  } catch (error) {
    console.error('Error fetching or encoding the file:', error.toString());
    throw error; // Re-throw the error for debugging
  }
};

// Standard API response structure
function createApiResponse(success, message, payload) {
  return ContentService.createTextOutput(
    JSON.stringify({
      info: {
        success: success,
        timestamp: new Date().toISOString(),
        message: message,
      },
      payload: payload,
    })
  ).setMimeType(ContentService.MimeType.JSON);
}


function getAccessToken(userId) {
    const properties = PropertiesService.getScriptProperties();
    const userData = JSON.parse(properties.getProperty(userId));
    //const token = JSON.parse(properties.getProperty(userData.access_token));
    let token = userData.access_token;
    const tokenExpiry = new Date(userData.timestamp).getTime() + userData.expires_in * 1000;
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    const currentTime = Date.now();
    console.log("userData", userData);
  
    // Check if the token is about to expire and refresh if necessary
    if (currentTime >= tokenExpiry - bufferTime) {
      // Token is about to expire, so refresh it
      logMessage("Info", "Refreshing token for userID" + userId);
      const refreshedToken = refreshToken(userData.refresh_token);
      // Update the user's tokens
      userData.access_token = refreshedToken.access_token;
      userData.refresh_token = refreshedToken.refresh_token;
      userData.expires_in = refreshedToken.expires_in;
      userData.timestamp = new Date().toISOString();
      properties.setProperty(userId, JSON.stringify(userData)); // Save to PropertiesService
      token = refreshedToken.access_token;
  
      // Handle failure to refresh the token
      if (!refreshedToken) {
        return createApiResponse(false, "Failed to refresh token", null, tokenExpiry);
      }
    } else {
      logMessage("Info", "No need to refresh token");
    }
    return(token);
  }
  
  // Refresh token and update properties
  function refreshToken(refreshToken) {
    const tokenUrl = "https://api.freeagent.com/v2/token_endpoint";
    const payload = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    };
  
    // Encode payload manually
    const encodedPayload = Object.keys(payload)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(payload[key])}`)
      .join("&");
  
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      payload: encodedPayload, // Use manually encoded payload
    };
  
    try {
      console.log("Sending POST request to:", tokenUrl);
      const response = UrlFetchApp.fetch(tokenUrl, options);
      const data = JSON.parse(response.getContentText());
      return data;
    } catch (error) {
      console.error("Failed to refresh token:", error.message);
      if (error.response) {
        console.error("Error Response:", error.response.getContentText());
      }
      return null;
    }
  }


  function downloadFAAttachment(accessToken, requestData) {
    // Build the FreeAgent API URL
    const url = requestData.url;
    logMessage("DEBUG","Access token",accessToken);
    logMessage("DEBUG","URL",url);
  
    const options = {
      method: "get",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true
    };
  
  
    // Fetch attachment details
    const response = UrlFetchApp.fetch(url, options);
    const jsonResponse = JSON.parse(response.getContentText());
    const statusCode = response.getResponseCode();
    const attachmentJson = jsonResponse.attachment;
    
    if (response.getResponseCode() === 200) {
         logMessage("INFO", "Attachment url retrieved", attachmentJson);
         return { success: true, message: "Attachment url retrieved", url: attachmentJson };
       } else {
         logMessage("ERROR", "Error getting url - jsonResponse = ", JSON.stringify(jsonResponse, null, 2));
         return { success: false, message: "Error getting url",jsonResponse};
       } 
  }
  
  