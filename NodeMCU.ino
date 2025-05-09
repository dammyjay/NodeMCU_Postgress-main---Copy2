#include <WiFi.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// ==== CONFIGURATION ====
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define SERVER_URL "https://nodemcu-nodejs-pgsql.onrender.com/postData2"

String userEmail = ""; // will be received via BLE
float temp, humidity;

// BLE UUIDs
#define SERVICE_UUID "12345678-1234-1234-1234-1234567890ab"
#define CHARACTERISTIC_UUID "abcd1234-abcd-1234-abcd-1234567890ab"

BLECharacteristic *emailCharacteristic;

// ==== BLE CALLBACK ====
class EmailCallback : public BLECharacteristicCallbacks
{
    void onWrite(BLECharacteristic *pCharacteristic)
    {
        std::string value = pCharacteristic->getValue();
        userEmail = String(value.c_str());
        Serial.println("📩 Received Email via BLE: " + userEmail);
    }
};

void setupBLE()
{
    BLEDevice::init("ESP32-CALICARE");
    BLEServer *pServer = BLEDevice::createServer();
    BLEService *pService = pServer->createService(SERVICE_UUID);

    emailCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_WRITE);

    emailCharacteristic->setCallbacks(new EmailCallback());
    pService->start();

    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->start();
    Serial.println("🟢 BLE Advertising Started");
}

// ==== Wi-Fi ====
void setupWiFi()
{
    Serial.println("🔌 Connecting to WiFi...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\n✅ WiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
}

// ==== Setup ====
void setup()
{
    Serial.begin(115200);
    delay(1000);
    pinMode(LED_BUILTIN, OUTPUT);

    setupWiFi();
    setupBLE();
}

// ==== POST Sensor Data ====
void sendToServer()
{
    if (userEmail == "")
    {
        Serial.println("⚠️ No email set. Skipping POST...");
        return;
    }

    temp = 25 + (random(0, 1000) / 100.0);     // 25 - 35
    humidity = 40 + (random(0, 1000) / 100.0); // 40 - 50

    String postData = "temperature=" + String(temp, 2) +
                      "&humidity=" + String(humidity, 2) +
                      "&email=" + userEmail;

    Serial.println("📤 POSTING: " + postData);

    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");

    int httpCode = http.POST(postData);
    String response = http.getString();

    if (httpCode == 200)
    {
        Serial.println("✅ Data Sent Successfully");
        Serial.println("📄 Server: " + response);
    }
    else
    {
        Serial.print("❌ Failed to send. Code: ");
        Serial.println(httpCode);
    }

    http.end();
}

void loop()
{
    sendToServer();

    digitalWrite(LED_BUILTIN, LOW);
    delay(2000);
    digitalWrite(LED_BUILTIN, HIGH);

    delay(8000); // Send data every 10 seconds
}
