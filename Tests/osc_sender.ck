"localhost" => string hostname;
9000 => int port;

OscSend xmit;

xmit.setHost(hostname, port);

while(1) {
    
    xmit.startMsg ( "/amplifier/touch", "i i i" );
    
    Math.random2(0, 1) => xmit.addInt; // Event Type (up/down, 0 or 1)
    Math.random2(0, 3) => xmit.addInt; // Group/Galileo #
    Math.random2(0, 8) => xmit.addInt; // Pin (Sensor ID)

    
    <<< "Sent Message" >>>; 
        
    1::second => now;
  
} 
