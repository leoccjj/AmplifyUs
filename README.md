EYEO_AmplifyUs
==============

AmplifyUs interactive installation in the Minneapolis Orchestra Hall for EYEO / Northern Spark festival 2014.

# About 

Amplify Us is a site-specific installation for Minneapolis’ Orchestra Hall that senses, visualizes, and sonifies the presence of people in building’s entrance. Commissioned by EYEO, a yearly conference on the intersection of arts and engineering, the installation is co-produced by Northern Spark, a yearly city-wide arts festival. 

Unique, architecturally-inspired touch panels were designed as the focal point of the installation, acting as inputs into a system which orchestrates a playful show of music and light. The installation explores how conversations and interactions in urban public spaces are influenced by a building that can respond visually and musically. With an array of controllable theatrical lights illuminating features of the Hall’s interior, a musical score unfolds and responds from interactions on the touch panels located on structural columns in the Hall’s entrance. 

Support for Amplify Us came from the EYEO Festival. Further support came from Intel Labs' User Experience Research (UXR), Perceptual Computing (PerC), and the Minnesota Orchestral Association. Additional thanks to the organizers of the Northern Spark festival. 

# Structure

A node.js app contains all the control logic for the dmx lights, touch panels, and audio. The Arduino-based touch/light panels use bidirectional OSC messages with the node app via wifi. A simulation/debugging/control UI lives in a browser alongside the audio engine (based on WebAudio).

# Installation

	npm install
	
	gem install compass

	grunt watch

	node app.js (--live)

# DMX-Specific Dependencies 

	https://github.com/wiedi/node-dmx

	https://github.com/KABA-CCEAC/node-ftdi

	http://www.ftdichip.com/Drivers/D2XX.htm
