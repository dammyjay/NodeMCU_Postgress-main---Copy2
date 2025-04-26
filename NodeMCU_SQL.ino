/* Code Written by Rishi Tiwari
 *  Website:- https://tricksumo.com
 * Use this file if your hosting provider supports HTTPS (SSL/TLS).
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h> 

#define HOST "https://nodemcu-nodejs-pgsql.onrender.com/postData"
#define WIFI_SSID ""            // WIFI SSID here                                   
#define WIFI_PASSWORD ""        // WIFI password here

// Declare global variables which will be uploaded to the server
float temp;
float humidity;

String sendTemp, sendHumidity, postData;

void setup() {

Serial.begin(115200); 
Serial.println("Communication Started \n\n");  
delay(1000);

pinMode(LED_BUILTIN, OUTPUT);     // initialize built-in LED on the board

WiFi.mode(WIFI_STA);           
WiFi.begin(WIFI_SSID, WIFI_PASSWORD);                                     // try to connect with WiFi
Serial.print("Connecting to ");
Serial.print(WIFI_SSID);
while (WiFi.status() != WL_CONNECTED) 
{ 
    Serial.print(".");
    delay(500); 
}

Serial.println();
Serial.print("Connected to ");
Serial.println(WIFI_SSID);
Serial.print("IP Address is : ");
Serial.println(WiFi.localIP());    // print local IP address

delay(30);
}

void loop() { 

HTTPClient http;    // http object of class HTTPClient
WiFiClientSecure wclient; // wclient object of class HTTPClient    

// Disable SSL certificate validation (not secure, but needed if you don't have certificates)
 wclient.setInsecure(); 

// Generate random values for temperature and humidity
temp = 25 + static_cast<float>(rand()) / (static_cast<float>(RAND_MAX / (40 - 25)));
humidity = 30 + static_cast<float>(rand()) / (static_cast<float>(RAND_MAX / (60 - 30)));

// Convert float variables to string
sendTemp = String(temp, 2);  // 2 decimal places
sendHumidity = String(humidity, 2);   

postData = "temperature=" + sendTemp + "&humidity=" + sendHumidity;

http.begin(wclient, HOST);
http.addHeader("Content-Type", "application/x-www-form-urlencoded"); 
  
int httpCode = http.POST(postData); 
  
// Print status code
Serial.print("HTTP Response Code: ");
Serial.println(httpCode);
String webpage = http.getString();    // Get HTML webpage output and store it in a string
Serial.println(webpage + "\n"); 

// if connection established then do this
if (httpCode == 200) { 
    Serial.println("Values uploaded successfully."); 
}
// if failed to connect then return and restart
else { 
    Serial.println("Failed to upload values. \n"); 
    http.end(); 
    return; 
}

delay(3000); 
digitalWrite(LED_BUILTIN, LOW);
delay(3000);
digitalWrite(LED_BUILTIN, HIGH);
}