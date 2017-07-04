var $fire = {}
var $ = require('jquery')
var tonal = require('tonal')
var Wad = require('web-audio-daw')
var socket



$(document).ready(function() {


	$fire.sound_list = {}
	$fire.shape_list = {}




	var frequency_min = 27.5 //Hz of A0
	var frequency_max = 261.63 //Hz of C8

	var delay_feedback_min = 1
	var delay_feedback_max = 0

	$fire.selected_instrument = $('#instrument-select').val()

	var instrument;

	$('#instrument-select').on('change',function(){
		$fire.selected_instrument = $(this).val()
	})

	var soundid = 0
	var shapeid = 0
	var canvas = $('.content').get(0)
	var context = canvas
	$fire.context = context
	var rect = {}
	var drag = false
	var current_shape

	canvas.width = canvas.offsetWidth
	canvas.height = canvas.offsetHeight




	var bebop = tonal.scale.notes('C bebop')

	
	


	$(document).on('mousedown','.content',function(e){
		var x_pos = e.pageX
		var y_pos = e.pageY - 50
		var winW = $('.content').width()
		var winH = $('.content').height()

		//reset canvas size
		canvas.width = canvas.offsetWidth
		canvas.height = canvas.offsetHeight

		var frequency_map = x_pos.map(0,winW,frequency_min,frequency_max)
		var delay_feedback_map = y_pos.map(25,winH,delay_feedback_min,delay_feedback_max)
		

		


		instrument = start_instrument($fire.selected_instrument,frequency_map,delay_feedback_map)


		rect.startX = x_pos
		rect.startY = y_pos
		rect.id = shapeid
		drag = true
		draw(context,rect.startX,rect.startY,shapeid)
		current_shape = shapeid

		var instrument_params = {
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
		
		socket.emit('local-sound',instrument_params)



	})

	$(document).on('mouseup','.content',function(e){

		instrument.stop()
		undraw(current_shape)
		

		socket.emit('local-sound-stop',{id: soundid, shapeid: shapeid})
		soundid++
		shapeid++
		drag = false




	})


	$(window).on('load',function(){

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
	})


})

















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

