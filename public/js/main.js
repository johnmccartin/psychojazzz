var $fire = {}								// our global namespace
var $ = require('jquery')					// our js wrapper
var interact = require('interactjs')
var tonal = require('tonal')				// music theory fxns
var Wad = require('web-audio-daw')			// audio generation
var io = require('socket.io-client')		// passing data back and forth
var socket									// globalize socket variable

var canvas, context, rect = {}, drag = false, current_shape




$(document).ready(function() {
	var $b = $('body')
	var $xo = 'xy'


	if($b.hasClass('home')) {
		watch_scale_lock() //watch if user checks or unchecks the scale lock

		// while we can handle audio and canvas objects made locally without logging them,
		// we need to keep track of foreign audio and canvas objects, so that we can stop them later
		// these objects will hold lists of foreign sounds and shapes marked by ids generated abroad
		$fire.sound_list = {}
		$fire.shape_list = {}

		// initialize the ids to send to foreign machines for them to store
		// THIS IS A FUCKED UP SYSTEM. WHAT IF THERE ARE MORE THAN TWO PLAYERS?
		// THE TWO FOREIGN PLAYERS WILL SEND IDS THAT ARE IDENTICAL
		// UPDATE TO USE NPM MODULE 'random-id'
		var soundid = 0
		var shapeid = 0

		// default scale_lock to false
		// checking will change this var globally
		$fire.scale_lock = false

		// load scale for use in scale locking
		// this will need to be programmable and pulled from the room object
		var bebop = tonal.scale.notes('C bebop')
		var pentatonic = tonal.scale.notes('C pentatonic')


		// temporarily we'll  set the min and max frequencies that we'll map from X
		// this will need to be programmable and pulled from the instrument object
		var frequency_min = 27.5 //Hz of A0
		var frequency_max = 261.63 //Hz of C8

		$fire.frequency_min = frequency_min
		$fire.frequency_max = frequency_max

		// temporarily we'll  set the min and max frequencies that we'll map from Y
		// this will need to be programmable and pulled from the instrument object
		var delay_feedback_min = 1
		var delay_feedback_max = 0

		// initialize the instrument selection from the room default
		$fire.selected_instrument = $('#instrument-select').val()

		// change the instrument selection with the select element
		$('#instrument-select').on('change',function(){
			$fire.selected_instrument = $(this).val()
		})



		// prepare the DOM to read XY values and to start drawing
		// NB we're not actually using an HTML canvas, but the DOM to draw
		canvas = $('.content').get(0)
		context = canvas
		$fire.context = context
		rect = {}
		drag = false
		current_shape
		canvas.width = canvas.offsetWidth
		canvas.height = canvas.offsetHeight


		var local_instrument;

		$(document).on('mousedown','.content',function(e){

			// Read X and Y
			var x_pos = e.pageX
			var y_pos = e.pageY - 50
			var winW = $('.content').width()
			var winH = $('.content').height()

			//reset canvas size
			canvas.width = canvas.offsetWidth
			canvas.height = canvas.offsetHeight

			// map X and Y to parameter scales (pulling mins and maxes from above)
			// this will need to be abstracted to account for other paramters
			var frequency_map = x_pos.map(0,winW,frequency_min,frequency_max)
			var delay_feedback_map = y_pos.map(25,winH,delay_feedback_min,delay_feedback_max)

			
			// if scale lock is turned on, shift the mapped X (frequency) to the nearest note on the room's scale
			if ( $fire.scale_lock == true ) {
				frequency_map = nearest_freq(frequency_map,scale_to_freq_list(pentatonic))
			}


			// instantiate a WAD sound into a variable and begin playing. you can turn it off later by using this var
			local_instrument = start_instrument($fire.selected_instrument,frequency_map,delay_feedback_map)

			// instantiate 
			rect.startX = x_pos
			rect.startY = y_pos
			rect.id = shapeid
			
			draw(context,rect.startX,rect.startY,shapeid)
			current_shape = shapeid


			// set dragability to true
			drag = true 


			// compile new sound/shape params into one object to send abroad
			var instrument_params_to_send = {
				instrument: $fire.selected_instrument,
				param1: frequency_map,
				param2: delay_feedback_map,
				id: soundid,
				shapeid: shapeid,
				x: x_pos,
				y: y_pos,
				device_width: canvas.width,
				device_height: canvas.height
			}
			
			// send new sound/shape abroad
			socket.emit('local-sound',instrument_params_to_send)



		})

		$(document).on('mouseup','.content',function(e){

			// stop the sound and remove the shape locally
			local_instrument.stop()
			undraw(current_shape)
			
			// send info on the stopped sound and shape abroad
			socket.emit('local-sound-stop',{id: soundid, shapeid: shapeid})


			// increment sound and shape IDs
			// TO BE CHANGED WHEN UNIQUE IDs are introduced
			soundid++
			shapeid++

			// set dragability back to false
			drag = false




		})
	} else if ($b.hasClass('builder')) {
		rebuilder();


		

	}


	
	


}) //ready



$(window).on('load',function(){
	  console.log('loaded')
	  socket = io.connect(window.location.href)
	  var i = 0;


	  
	  socket.on('greet', function (data) {
	      socket.emit('respond', { message: 'Hey there, server!' });
	  });

	  socket.on('foreign-sound', function (data) {
	  	console.log('ay foreign-sound')
	  	
	  	var id = data.id
	  	var orig_x = data.x
	  	var orig_y = data.y
	  	var device_width = data.device_width
	  	var device_height = data.device_height

	  	var new_x = orig_x.map(0,device_width,0,canvas.width)
	  	var new_y = orig_y.map(0,device_height,0,canvas.height)



	  	$fire.sound_list[id] = start_instrument(data.instrument,data.parameter1,data.parameter2)
	  	draw($fire.context,new_x,new_y,data.shapeid)

	  })

	  socket.on('foreign-sound-stop',function (data) {
	  	stop_instrument(data.id)
	  	undraw(data.shapeid)
	  })

}) //loaded













var instruments = {
	saw : {
		args : {
		    source  : 'sawtooth',
		    volume  : 1.0,   // Peak volume can range from 0 to an arbitrarily high number, but you probably shouldn't set it higher than 1.
		    pitch   : 'A2',  // Set a default pitch on the constuctor if you don't want to set the pitch on play().
		    detune  : 0,     // Set a default detune on the constructor if you don't want to set detune on play(). Detune is measured in cents. 100 cents is equal to 1 semitone.
		    panning : -.5,    // Horizontal placement of the sound source. Possible values are from 1 to -1.

		    env     : {      // This is the ADSR envelope.
		        attack  : 0.0,  // Time in seconds from onset to peak volume.  Common values for oscillators may range from 0.05 to 0.3.
		        decay   : 0.0,  // Time in seconds from peak volume to sustain volume.
		        sustain : 1.0,  // Sustain volume level. This is a percent of the peak volume, so sensible values are between 0 and 1.
		        hold : 120,
		        release : 1     // Time in seconds from the end of the hold period to zero volume, or from calling stop() to zero volume.
		    },
		    filter  : {
		        type      : 'lowpass', // What type of filter is applied.
		        frequency : 600,       // The frequency, in hertz, to which the filter is applied.
		        q         : 1,         // Q-factor.  No one knows what this does. The default value is 1. Sensible values are from 0 to 10.
		        env       : {          // Filter envelope.
		            frequency : 800, // If this is set, filter frequency will slide from filter.frequency to filter.env.frequency when a note is triggered.
		            attack    : 0.5  // Time in seconds for the filter frequency to slide from filter.frequency to filter.env.frequency
		        }
		    },
		    delay   : {
		        delayTime : .5,  // Time in seconds between each delayed playback.
		        wet       : .25, // Relative volume change between the original sound and the first delayed playback.
		        feedback  : .25, // Relative volume change between each delayed playback and the next. 
		    }
		},
		parameter_string : function(parameter1,parameter2){

				return '{"pitch" : '+parameter1+', "delay" : {"feedback" : '+parameter2+'}}'

			}
	},
	sine : {
		args : {
		    source  : 'sine',
		    volume  : 1.0,   // Peak volume can range from 0 to an arbitrarily high number, but you probably shouldn't set it higher than 1.
		    pitch   : 'A2',  // Set a default pitch on the constuctor if you don't want to set the pitch on play().
		    detune  : 0,     // Set a default detune on the constructor if you don't want to set detune on play(). Detune is measured in cents. 100 cents is equal to 1 semitone.
		    panning : -.5,    // Horizontal placement of the sound source. Possible values are from 1 to -1.

		    env     : {      // This is the ADSR envelope.
		        attack  : 0.0,  // Time in seconds from onset to peak volume.  Common values for oscillators may range from 0.05 to 0.3.
		        decay   : 0.0,  // Time in seconds from peak volume to sustain volume.
		        sustain : 1.0,  // Sustain volume level. This is a percent of the peak volume, so sensible values are between 0 and 1.
		        hold : 120,
		        release : 1     // Time in seconds from the end of the hold period to zero volume, or from calling stop() to zero volume.
		    },
		    filter  : {
		        type      : 'lowpass', // What type of filter is applied.
		        frequency : 600,       // The frequency, in hertz, to which the filter is applied.
		        q         : 1,         // Q-factor.  No one knows what this does. The default value is 1. Sensible values are from 0 to 10.
		        env       : {          // Filter envelope.
		            frequency : 800, // If this is set, filter frequency will slide from filter.frequency to filter.env.frequency when a note is triggered.
		            attack    : 0.5  // Time in seconds for the filter frequency to slide from filter.frequency to filter.env.frequency
		        }
		    },
		    delay   : {
		        delayTime : .5,  // Time in seconds between each delayed playback.
		        wet       : .25, // Relative volume change between the original sound and the first delayed playback.
		        feedback  : .25, // Relative volume change between each delayed playback and the next. 
		    }
		},
		parameter_string : function(parameter1,parameter2){

				return '{"pitch" : '+parameter1+', "delay" : {"feedback" : '+parameter2+'}}'

			}
	}

}








function start_instrument(name,input1,input2) {

	var instrument = new Wad(instruments[name].args)
	var updated_parameters = instruments[name].parameter_string(input1,input2)
	var updated_parameters = JSON.parse(updated_parameters)

	instrument.play(updated_parameters);

	return instrument;

}

function stop_instrument(id) {

	var instrument = $fire.sound_list[id]
	instrument.stop()

	return instrument;
	
}


function draw(context,x,y,shapeid) {

		var rectW = 40
		var rectH = 40
		var bg_color = '#ffffff'



		var circle = document.createElement('div');
		var $circle = $(circle)

		$circle.css({width: rectW,height: rectH,background: bg_color, top: y + rectH/2, left: x - rectW/2}).addClass('circle').attr('data-circle-id',shapeid)


		context.append(circle)

}

function undraw(shapeid) {
	$(document).find('.circle[data-circle-id="'+shapeid+'"]').remove()
}

Number.prototype.map = function (in_min, in_max, out_min, out_max) {
  return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}



function scale_to_freq_list(scale_array) {
	var scale_array_new = []
	var freq_array = []






	for (var i=0; i < scale_array.length; i++) {



		for ( var octave_iter=0; octave_iter < 8; octave_iter++) {
			var freq = tonal.note.freq(scale_array[i]+octave_iter.toString())
			freq_array.push(freq)
		}



	}
	
	freq_array.sort()
	return freq_array

}

function nearest_freq(freq,scale_array){

	
	var closest_note = scale_array[0]
	var diff = Math.abs(freq - closest_note)

	for (i=0; i<scale_array.length; i++) {

		var new_diff = Math.abs(freq - scale_array[i])
		
		if ( new_diff < diff ) {
			diff = new_diff
			closest_note = scale_array[i]
		}
		
	}
	//console.log(closest_note)

	return closest_note

}

function watch_scale_lock() {
	$(document).on('change','#scale-lock',function(){

		if(this.checked) {
			$fire.scale_lock = true
		} else {
			$fire.scale_lock = false
		}

	})
}

function make_draggable() {
	
	interact('.draggable')
  .draggable({
    inertia: true,
    autoScroll: true,
    restriction: {},
    onmove: dragMoveListener,
    onend: function (event) {}
  });

  function dragMoveListener (event) {
    var target = event.target,
        // keep the dragged position in the data-x/data-y attributes
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

    // translate the element
    target.style.webkitTransform =
    target.style.transform =
      'translate(' + x + 'px, ' + y + 'px)';

    // update the posiion attributes
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
  }

  // this is used later in the resizing and gesture demos
  window.dragMoveListener = dragMoveListener;
}

function make_droppable() {

	interact('.dropzone').dropzone({
	  accept: '.module',
	  overlap: 0.1,

	  // listen for drop related events:

	  ondropactivate: function (event) {
	    // add active dropzone feedback
	    event.target.classList.add('drop-active');
	  },
	  ondragenter: function (event) {
	    var draggableElement = event.relatedTarget,
	        dropzoneElement = event.target;

	    // feedback the possibility of a drop
	    
	  },
	  ondragleave: function (event) {
	    // remove the drop feedback style
	    
	  },
	  ondrop: function (event) {
	    //event.relatedTarget.textContent = 'Dropped';
	  
	  },
	  ondropdeactivate: function (event) {
	    // remove active dropzone feedback
	    
	  }
	});
}






function log(message) {
	console.log(message)
}

function rebuilder(){
	console.log('builder')
		make_draggable()
		make_droppable()

		var modules_active = ['generator']

		//set up all potential parameters, define defaults and initialize actives
		var parameters = {}
		parameters.generator = {
			source : { default : 'square', active : null },
			volume : { default : 1.0, active : null },
			pitch : { default : 'A2', active : null },
			detune : { default : 0, active : null },
			panning : { default : 0, active : null }
		}

		parameters.env = {
				attack		: { default : 0, active : null },
				decay		: { default : 0.0, active : null },
				sustain 	: { default : 1.0, active : null },
				hold		: { default : 0.25, active : null },
				release 	: { default : 1, active : null },
		}
		parameters.filter = {
				type  		: { default : 'lowpass', active : null },
				frequency 	: { default : 800, active : null },
				q			: { default : 1, active : null },
				env			: {
					frequency	: { default : 800, active : null },
					attack		: { default : 0.5, active : null }
				}

		}
		parameters.delay = {
			delayTime		: { default : 0, active : null },
			wet				: { default : 0, active : null },
			feedback		: { default : 0, active : null }
		}


		//set up all actives as defaults
		parameters.generator.source.active = parameters.generator.source.default;
		parameters.generator.volume.active = parameters.generator.volume.default;
		parameters.generator.pitch.active = parameters.generator.pitch.default;
		parameters.generator.detune.active = parameters.generator.detune.default;
		parameters.generator.panning.active = parameters.generator.panning.default;

		parameters.env.attack.active = parameters.env.attack.default;
		parameters.env.decay.active = parameters.env.decay.default;
		parameters.env.sustain.active = parameters.env.sustain.default;
		parameters.env.hold.active = parameters.env.hold.default;
		parameters.env.release.active = parameters.env.release.default;

		parameters.filter.type.active = parameters.filter.type.default;
		parameters.filter.frequency.active = parameters.filter.frequency.default;
		parameters.filter.q.active = parameters.filter.q.default;
		parameters.filter.env.frequency.active = parameters.filter.env.frequency.default;
		parameters.filter.env.attack.active = parameters.filter.env.attack.default;

		parameters.delay.delayTime.active = parameters.delay.delayTime.default;
		parameters.delay.wet.active = parameters.delay.wet.default;
		parameters.delay.feedback.active = parameters.delay.feedback.default;

		$(document).on('change','.parameter-value',function(e) {

			var $t = $(this);
			var $parameter = $t.parents('.parameter')
			var module = $parameter.attr('data-parent-module')
			var parameter_name = $parameter.attr('data-parameter-name')

			var value = $t.val()
			if($parameter.hasClass('number-parameter')) {
				value = parseFloat(value)
			}


			if( module == 'filter' && $parameter == 'env' ) {

				
			} else {

				parameters[module][parameter_name]['active'] = value

			}

			console.log(parameters)

		})



		$(document).on('click','.instrument-tester', function() {
			$fake_variable_polywad = null
			if ($fake_variable_polywad == true) {

				/*
				voice_count = 0
				for each voice in voices :
					set up args as wad args

					
					var polyVoices[voice_count] = new Wad(args)
				
				var myPoly = new Wad.Poly()

				for i = 0; i < voice_count.length; i++ :
					polyWad.add(polyVoices[i])
					

				*/

			} else {
				var test_instrument_args = {
				    source  : parameters.generator.source.active,
				    volume  : parameters.generator.volume.active,   
				    pitch   : parameters.generator.pitch.active,  
				    detune  : parameters.generator.detune.active,    
				    panning : parameters.generator.panning.active,

				    env     : {      
				        attack  : parameters.env.attack.active,  
				        decay   : parameters.env.decay.active,  
				        sustain : parameters.env.sustain.active,  
				        hold : parameters.env.hold.active,
				        release : parameters.env.release.active     
				    },
				    filter  : {
				        type      : parameters.filter.type.active, 
				        frequency : parameters.filter.frequency.active,      
				        q         : parameters.filter.q.active,         
				        env       : {         
				            frequency : parameters.filter.env.frequency.active, 
				            attack    : parameters.filter.env.attack.active  
				        }
				    },
				    delay   : {
				        delayTime : parameters.delay.delayTime.active,  
				        wet       : parameters.delay.wet.active, 
				        feedback  : parameters.delay.feedback.active, 
				    }    
				}

				var instrument = new Wad(test_instrument_args)
				instrument.play()
			}
		})

}



