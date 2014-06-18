"192.168.1.103" => string hostname;
12001 => int port;

OscSend xmit;

xmit.setHost(hostname, port);

while(1) {
    

    xmit.startMsg ( "p|255|255|255", "");
    
    <<< "Sent Message" >>>; 
    
    1::second => now;
    
} 
