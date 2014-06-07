"localhost" => string hostname;
12000 => int port;

OscSend xmit;

xmit.setHost(hostname, port);

0 => int counter; 

while(1) {
    
    counter++;
    
    xmit.startMsg ( "/touch", "i i i" );
    counter % 4 => xmit.addInt; // Group/Galileo #
    Std.rand2(0, 3) => xmit.addInt; // Pin (Sensor ID)
    1 => xmit.addInt; // Event Type (up/down, 0 or 1)
    
    <<< counter % 4 >>>; 
    
    <<< "Sent Message" >>>; 
    
    0.5::second => now;
    
} 
