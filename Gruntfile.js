'use strict';

module.exports = function(grunt) {

  require('time-grunt')(grunt);

  // Project configuration.
  grunt.initConfig({

    watch: {
      assemble: {
        files: ['client/{content,data,templates,sass}/{,*/}*.{md,hbs,yml,scss}'],
        tasks: ['sass']
      }
    },

    connect: {
      options: {
        port: 9000,        // clperge this to '0.0.0.0' to access the server from outside
        hostname: 'localhost'
      }
    },

    sass: {                              // Task
      dist: {                            // Target
        options: {                       // Target options
          style: 'expanded',
          compass: true, 
        },
        files: {
          'client/stylesheets/screen.css': 'client/sass/screen.scss',       // 'destination': 'source'
        }
      }
    }, 

  });

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-sass');

  grunt.registerTask('server', [
    'connect:livereload',
    'watch'
  ]);

  grunt.registerTask('build', [
    'sass', 
  ]);

  grunt.registerTask('default', [
    'build'
  ]);

};
