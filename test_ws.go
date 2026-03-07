package main

import (
	"log"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

func main() {
	u := url.URL{Scheme: "ws", Host: "localhost:8080", Path: "/ws"}
	log.Printf("Connecting to %s", u.String())

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatalf("Dial error: %v", err)
	}
	defer c.Close()

	log.Println("Connected!")

	// Read the first message
	_, message, err := c.ReadMessage()
	if err != nil {
		log.Fatalf("Read error: %v", err)
	}
	log.Printf("Received: %s", message)
	time.Sleep(1 * time.Second)
}
