const PI = Math.PI;
const main_point = [3.046327, 101.695932];
const particle_color = {
	r : 255,
	g : 255,
	b : 255,
	a : 1
};
const pixi_tail = 0xffffff;

init();

function init(){
    var map = init_mapbox("map");
    var globe = init_globe("globe");
    var pixi = init_PIXI(map);
    init_stats();

    map.on("load", function(){
    	//add_point_globe(globe, main_point);

	    link_map_globe(map, globe);

	    add_pubnub(map, globe, pixi);
    });

//     document.getElementById("clear-all").onclick = function() {
//     	console.log("clear-all");
//     	for(var i = 0; i < anim.items.length; i++){
//     		var item = anim.items[i];
//     		item.tween_start.kill();
//     		item.tween_run.kill();

//     		//globe
// 			globe.earthMesh.remove(item.globe.line);
// 			item.globe.loc = [0, _this.globe.radius, 0];
// 			item.particle_size = 0;
// 			//pixi
// 			pixi.tailcontainer.removeChild(item.pixi.tailSprite);
// 			pixi.worldcontainer.removeChild(item.pixi.headSprite);
//     	}
//     	anim.items = [];
//     };
};

function add_pubnub(map, globe, pixi){
	anim.init(map, globe, pixi);
	anim.animate();

	PUBNUB.init({
        subscribe_key: 'sub-c-78806dd4-42a6-11e4-aed8-02ee2ddab7fe',
        ssl: true
    }).subscribe({
        channel: 'pubnub-twitter',
        message: throttle( function(msg) { 

	        // process your last message here each 500ms.
	        if (!msg || !msg.place || !msg.place.bounding_box)
                return;

            var southWest = msg.place.bounding_box.coordinates[0][0];
            var northEast = msg.place.bounding_box.coordinates[0][2];
            var center_lat = southWest[1] + (northEast[1]-southWest[1])/2;
            var center_lng = southWest[0] + (northEast[0]-southWest[0])/2;

            if(anim.items.length <= anim.max_points) anim.add_data([center_lat,center_lng], main_point,msg.text.length*0.02);

	    }, 10 /* milliseconds */ )
    });

    function throttle( fun, rate ) {
	    var last;

	    setInterval( function() {
	        last !== null && fun(last);
	        last = null;
	    }, rate );

	    return function(message) { last = message };
	}
}

function init_mapbox(mapid){
	mapboxgl.accessToken = 'pk.eyJ1IjoibW9oYW1hZHN1YmFraW4iLCJhIjoiY2l2c2t5eWsxMDVlMTJvcDdvY3dtcThyZyJ9.33m2TNizbXs2dT35vSksFw';
	var map = new mapboxgl.Map({
	    container: mapid,
	    style: 'mapbox://styles/mapbox/dark-v9',
	    //center: [main_point[1], main_point[0]],
	    center: [0, 0],
	    zoom: 1
	});

	// Add zoom and rotation controls to the map.
	map.addControl(new mapboxgl.NavigationControl());

	return map;
}

function init_globe(globeid){
	var radius = 100;

	var container = document.getElementById(globeid);
	var w = container.clientWidth;
	var h = container.clientHeight;
	var scene = new THREE.Scene();

	var camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000);
	camera.position.x = radius * 4;
	camera.lookAt(scene.position);

	var renderer = new THREE.WebGLRenderer( { alpha: true } );
	renderer.setSize(w, h);

	container.appendChild(renderer.domElement);

	//adding light
	scene.add(new THREE.AmbientLight(0x333333));

	var light = new THREE.DirectionalLight(0xffffff, 1);
	light.position.set(radius*5,radius*3,radius*5);
	scene.add(light);

	//add object
	var geometry   = new THREE.SphereGeometry(radius, 32, 32);
	var material  = new THREE.MeshPhongMaterial();

	var earthMesh = new THREE.Mesh(geometry, material);
	var earthX = new THREE.Group();
	var earthY = new THREE.Group();
	earthX.add(earthY);
	earthY.add(earthMesh);
	scene.add(earthX);

	earthY.rotation.ty = earthY.rotation.y;
	earthX.rotation.tz = earthX.rotation.z;

	//black map
	//create map texture
	var mapTextureCanvas = document.createElement("canvas");
	var mapTextureContext = mapTextureCanvas.getContext("2d");
	var mapTextureImage = new Image();
	mapTextureImage.src = "image/earthspec1k.jpg";

	var mapTexture = new THREE.Texture(mapTextureCanvas);

	mapTextureImage.onload = function(){
		var img_w = 1024;//avoid resize
		var img_h = 512;
		mapTextureCanvas.width = img_w;
		mapTextureCanvas.height = img_h;
		mapTextureContext.drawImage(mapTextureImage, 0, 0, img_w, img_h);
		//process the image here
		//get raw data
		var rawData = mapTextureContext.getImageData(0, 0, img_w, img_h);
		var pixelData = rawData.data;
		//make pure black n transparent
		for(var i = 0; i < pixelData.length; i+=4){
			if(pixelData[i] < 100){
				pixelData[i] = 0;
				pixelData[i+1] = 0;
				pixelData[i+2] = 0;
				pixelData[i+3] = 255;
			}
			else{
				pixelData[i] = 255;
				pixelData[i+1] = 255;
				pixelData[i+2] = 255;
				pixelData[i+3] = 0;
			}
		}

		rawData.data = pixelData;
		pixelData = null;

		//put back to context
		mapTextureContext.putImageData(rawData, 0, 0);
		mapTexture.needsUpdate = true;

		var innergeometry   = new THREE.SphereGeometry(radius - 3, 32, 32);
		var innermaterial  = new THREE.MeshPhongMaterial();
		
		var innerearthMesh = new THREE.Mesh(innergeometry, innermaterial);
		earthMesh.add(innerearthMesh);
	}

	material.map = mapTexture;
	material.side = THREE.DoubleSide;
	material.alphaTest = 0.75;

	var animate = function(){
		requestAnimationFrame(animate);
		renderer.render(scene, camera);

		//globe link
		if(earthX.rotation.tz){
			var speed = 0.1;
			earthY.rotation.y += (earthY.rotation.ty - earthY.rotation.y)*speed;
			earthX.rotation.z += (earthX.rotation.tz - earthX.rotation.z)*speed;
		}
	};

	animate();

	var resize = function(){
		w = container.clientWidth;
		h = container.clientHeight;
		renderer.setSize(w, h);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	};

	var three_2d_3d = function(lat, lng){
		var phi = (90 - lat) * Math.PI / 180;
		var theta = (180 - lng) * Math.PI / 180;

		var radiusr = radius + 2.5;

		return new THREE.Vector3( 
			-radiusr * Math.sin(phi) * Math.cos(theta),
			radiusr * Math.cos(phi), 
			-radiusr * Math.sin(phi) * Math.sin(theta) 
			);
	}

	// Create an event listener that resizes the renderer with the browser window.
    window.addEventListener('resize', resize);

	return {
		radius : radius,
		container : container,
		width : w,
		height : h,
		scene : scene,
		camera : camera,
		renderer : renderer,
		earthX : earthX,
		earthY : earthY,
		earthMesh : earthMesh,
		animate : animate,
		resize : resize,
		three_2d_3d : three_2d_3d
	};
}

function add_point_globe(globe, point){
	var pointGeo = new THREE.BoxGeometry(2, 2, 10);
	pointGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.25));
	var pointMat = new THREE.MeshBasicMaterial();
	pointMat.color= new THREE.Color("rgb(255,0,0)");
	var pointMesh = new THREE.Mesh(pointGeo, pointMat);

	var lat = point[0];
	var lng = point[1];

	var loc = globe.three_2d_3d(lat, lng);

	pointMesh.position.x = loc.x;
	pointMesh.position.y = loc.y;
	pointMesh.position.z = loc.z;

	pointMesh.lookAt(globe.scene.position);
	globe.earthMesh.add(pointMesh);

	globe.pointMesh = pointMesh;
}

function link_map_globe(map, globe){
	var globe_moving = false;

	//map
	map.on('move', update_globe);
    map.on('moveend', update_globe);

    update_globe();

    function update_globe(e){
    	if(!globe_moving){
	    	var map_center = map.getCenter()
	    	globe.earthX.rotation.tz = -map_center.lat * PI/180;
	    	globe.earthY.rotation.ty = -map_center.lng * PI/180;
	    }
    }

    //globe
    var mouse = {x: 0, y: 0};
	var mousemove = {x: 0, y: 0};

	globe.container.addEventListener('mouseover', onMouseOver, false);

    function onMouseDown(event){
		event.preventDefault();

		mouse.x = event.clientX;
		mouse.y = event.clientY;

		grabbing();

		globe.container.addEventListener('mousemove', onMouseMove, false);
		globe.container.addEventListener('mouseup', onMouseUp, false);
		globe.container.addEventListener('mouseout', onMouseOut, false);
	}

	function onMouseMove(event){

		var speed = 5;
		globe_moving = true;

	 	mousemove.x = event.clientX - mouse.x;
		mousemove.y = event.clientY - mouse.y;

		mouse.x = event.clientX;
		mouse.y = event.clientY;

		globe.earthY.rotation.ty += mousemove.x*speed/globe.width;
		globe.earthX.rotation.tz -= mousemove.y*speed/globe.height;

		if(globe.earthX.rotation.tz > PI/2) globe.earthX.rotation.tz = PI/2 - 0.01;
		if(globe.earthX.rotation.tz < -PI/2) globe.earthX.rotation.tz = -PI/2;

		var loc = [
			-globe.earthY.rotation.ty * 180/PI,
			-globe.earthX.rotation.tz * 180/PI,
		];

		map.easeTo({
	        center: loc
	    });
	}

	function onMouseUp(event){
		grab();

		globe.container.removeEventListener('mousemove', onMouseMove, false);
		globe.container.removeEventListener('mouseup', onMouseUp, false);
		globe.container.removeEventListener('mouseout', onMouseOut, false);

		map.once('moveend', function() {
	    	globe_moving = false;
	    });
	}

	function onMouseOut(event){
		globe.container.removeEventListener('mousemove', onMouseMove, false);
		globe.container.removeEventListener('mouseup', onMouseUp, false);
		globe.container.removeEventListener('mouseout', onMouseOut, false);

		map.once('moveend', function() {
	    	globe_moving = false;
	    });
	}

	function onMouseOver(event){
		grab();
		globe.container.addEventListener('mousedown', onMouseDown, false);
	}

	function grab(){
		globe.container.classList.remove("cursor-grabbing");
		globe.container.classList.add("cursor-grab");
	}

	function grabbing(){
		globe.container.classList.remove("cursor-grab");
		globe.container.classList.add("cursor-grabbing");
	}
}

function init_PIXI(map){
	var app = new PIXI.Application(map._canvas.clientWidth, map._canvas.clientHeight, { transparent: true });
	app.map = map;
	app.map.getCanvasContainer().appendChild(app.view);
	app.renderer.view.classList.add('mapboxgl-marker');//use marker class

	app.worldcontainer = new PIXI.Container();
	app.worldtexture = new PIXI.RenderTexture.create(map._canvas.clientWidth, map._canvas.clientHeight);
	//create a over sized/double to solve resize issue
	app.worldsprite = new PIXI.extras.TilingSprite(app.worldtexture, app.worldtexture.width*2, app.worldtexture.height*2);

	app.worldsprite.position.x = 0;
	app.worldsprite.position.y = 0;
	app.worldsprite.tilePosition.x = 0;
	app.worldsprite.tilePosition.y = 0;

	app.stage.addChild(app.worldsprite);

	app.convert_world_pos = {};
	app.convert_world_pos.paddingx = 0;
	app.convert_world_pos.convert = function(pos){
		pos.x -= app.convert_world_pos.paddingx
		return pos;
	};


	app.update_pos = function(){
		//detect range > 360;
		var map_bounds = map.getBounds();
		var ne_lng = map_bounds._ne.lng;
		var ws_lng = map_bounds._sw.lng;
		var map_range = ne_lng - ws_lng;
		var pos180 = app.map.project(app.map.transform.renderWorldCopies ? mapboxgl.lngLat.wrapToBestWorld(app.map.getCenter()) : mapboxgl.LngLat.convert([180,0]));
		var pos_180 = app.map.project(app.map.transform.renderWorldCopies ? mapboxgl.lngLat.wrapToBestWorld(app.map.getCenter()) : mapboxgl.LngLat.convert([-180,0]));
		var texture_width = pos180.x - pos_180.x;

		//console.log("map range", map_range);
		
		if(map_range > 30){
			app.worldtexture.resize(texture_width, map._canvas.clientHeight);
			app.convert_world_pos.paddingx = pos_180.x;
			app.worldsprite.tilePosition.x = pos_180.x;
		}
		else{
			app.worldtexture.resize(map._canvas.clientWidth, map._canvas.clientHeight);
			app.convert_world_pos.paddingx = -(Math.floor((ws_lng - 180)/360) + 1) * texture_width;
			//app.convert_world_pos.paddingx = -(Math.floor((ws_lng)/360) + 1) * texture_width;
			console.log("padding", app.convert_world_pos.paddingx);
			app.worldsprite.tilePosition.x = 0;
		}

		app.renderer.render(app.worldcontainer, app.worldtexture);
	}

	app.map.on('resize',function(e){
		e = e ? e.target : app.map;
        app.renderer.resize(e._canvas.clientWidth, e._canvas.clientHeight);
        app.update_pos();
	});

	app.map.on('move', app.update_pos);
    app.map.on('moveend', app.update_pos);
    app.update_pos();

	app.ticker.add(function(delta) {
		app.renderer.render(app.worldcontainer, app.worldtexture);
	});

	return app;
}

var anim = {
	init : function(map, globe, pixi){
		_this = this;
		this.map = map;
		this.globe = globe;
		this.pixi = pixi;

		//global
		this.items = [];
		this.line_details = 50;
		this.max_points = 1000;

		//globe var
		//this.globe.map_mask = THREE.ImageUtils.loadTexture("images/map_mask.png");
		this.globe.map_mask = new THREE.Texture(
								this.particle_texture_canvas(
									512,
									particle_color.r,
									particle_color.g,
									particle_color.b,
									particle_color.a
								)
							);
		this.globe.map_mask.needsUpdate = true;

		//buffergeometry
		this.globe.points_positions = new Float32Array( this.max_points * 3 );
		this.globe.points_colors = new Float32Array( this.max_points * 3 );
		this.globe.points_sizes = new Float32Array( this.max_points );
		
		//init val
		var color = new THREE.Color( 0xffffff );
		for ( var i = 0; i < this.max_points; i ++ ) {
			//color.setHSL( Math.random(), 0.7, 0.5 );
			color.toArray( this.globe.points_colors, i * 3 );
			this.globe.points_sizes[ i ] = 0;
		}
		this.globe.points_geometry = new THREE.BufferGeometry();
		this.globe.points_geometry.addAttribute( 'position', new THREE.BufferAttribute( this.globe.points_positions, 3 ) );
		this.globe.points_geometry.addAttribute( 'customColor', new THREE.BufferAttribute( this.globe.points_colors, 3 ) );
		this.globe.points_geometry.addAttribute( 'size', new THREE.BufferAttribute( this.globe.points_sizes, 1 ) );
		this.globe.points_material = new THREE.ShaderMaterial( {
			uniforms: {
				amplitude: { value: 1.0 },
				color:     { value: new THREE.Color( 0xffffff ) },
				texture:   { value: this.globe.map_mask }
			},
			vertexShader:   document.getElementById( 'vertexshader' ).textContent,
			fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
			blending:       THREE.AdditiveBlending,
			depthWrite: 	false, 
			transparent:    true
		});
		this.globe.Points = new THREE.Points( this.globe.points_geometry, this.globe.points_material );
		this.globe.earthMesh.add(this.globe.Points);

		//pixi vars
		var tailgraphics = new PIXI.Graphics();
		tailgraphics.lineStyle(0);
	    tailgraphics.beginFill(pixi_tail, 1);
	    tailgraphics.drawCircle(0, 0, 2);
	    tailgraphics.endFill();

	    this.pixi.tailtexture = this.pixi.renderer.generateTexture(tailgraphics);
	    this.pixi.sprite_size = 50;
	    this.pixi.SpriteTexture = PIXI.Texture.fromCanvas(this.particle_texture_canvas(
										this.pixi.sprite_size,
										particle_color.r,
										particle_color.g,
										particle_color.b,
										particle_color.a
									)
								);

	    this.pixi.tailcontainer = new PIXI.Container();
		this.pixi.tailcontainer.alpha = 0.85;
		this.pixi.tailcontainertexture = new PIXI.RenderTexture.create(map._canvas.clientWidth, map._canvas.clientHeight);
		this.pixi.tailcontainertexture2 = new PIXI.RenderTexture.create(map._canvas.clientWidth, map._canvas.clientHeight);
		this.pixi.tailcontainersprite = new PIXI.Sprite(this.pixi.tailcontainertexture);

		this.pixi.tailcontainer.addChild(this.pixi.tailcontainersprite);
		this.pixi.worldcontainer.addChild(this.pixi.tailcontainer);
		this.pixi.ticker.add(function(){
			var temp = _this.pixi.tailcontainertexture;
			_this.pixi.tailcontainertexture = _this.pixi.tailcontainertexture2;
			_this.pixi.tailcontainertexture2 = temp;
			_this.pixi.tailcontainersprite.texture = _this.pixi.tailcontainertexture;

			_this.pixi.renderer.render(_this.pixi.tailcontainer, _this.pixi.tailcontainertexture2);
		});
	},
	animate : function(){
		anim.animate_frame();
		anim.animate_timeout();
	},
	animate_frame : function(){
		requestAnimationFrame(anim.animate_frame);
		if(anim.items){
			for(var i = 0; i < anim.items.length; i++){
				var index = i*3;
				anim.globe.Points.geometry.attributes.position.array[index] =  anim.items[i].globe.loc[0];
				anim.globe.Points.geometry.attributes.position.array[index + 1] =  anim.items[i].globe.loc[1];
				anim.globe.Points.geometry.attributes.position.array[index + 2] =  anim.items[i].globe.loc[2];

				anim.globe.Points.geometry.attributes.size.array[i] =  anim.items[i].particle_size*40;

				if(anim.items[i].globe.loc[0] == 0 && anim.items[i].globe.loc[1] == anim.globe.radius && anim.items[i].globe.loc[2] == 0){
					anim.items.splice(anim.items.indexOf(anim.items[i]), 1);
					i--;
				}
			}

			anim.globe.Points.geometry.attributes.position.needsUpdate = true;
			anim.globe.Points.geometry.attributes.size.needsUpdate = true;
		}
	},
	animate_timeout : function(){
		setTimeout(anim.animate_timeout, 500);
		if(anim.items){
			for(var i = anim.items.length; i < anim.max_points; i++){
				var index = i*3;
				anim.globe.Points.geometry.attributes.position.array[index] =  0;
				anim.globe.Points.geometry.attributes.position.array[index + 1] =  anim.globe.radius;
				anim.globe.Points.geometry.attributes.position.array[index + 2] =  0;

				anim.globe.Points.geometry.attributes.size.array[i] =  0;
			}
		}
	},
	add_data : function(from, to, s){
		var item = {
			globe_count : 0,
			particle_size : 0,
			s : s,
			delay : Math.random()*5,
			lat : from[0],
			lng : from[1],
			globe : this.gen_globe_anim(from, to, s),
			pixi : this.gen_pixi_anim(from, s)
		};
		this.items.push(item);
		update_all();

		item.tween_start = TweenLite.to(
			item,
			5,
			{
				particle_size : s,
				ease :  Elastic.easeOut,
				delay : item.delay,
				onUpdate : function(){
					update_all();
				}
			}
		);

		item.tween_run = TweenLite.to(
			item,
			10,//time in seconds
			{
				globe_count : this.line_details - 0.01,
				lat : to[0],
				lng : to[1],
				ease : Power4.easeOut,
				delay : item.delay + 5,
				onUpdate : function(){
					update_all();
				},
				onComplete : function(){
					//globe
					_this.globe.earthMesh.remove(item.globe.line);
					//_this.globe.earthMesh.remove(item.globe.particle);
					item.globe.loc = [0, _this.globe.radius, 0];
					item.particle_size = 0;
					//pixi
					_this.pixi.tailcontainer.removeChild(item.pixi.tailSprite);
					_this.pixi.worldcontainer.removeChild(item.pixi.headSprite);
					//all
					//_this.items.splice(_this.items.indexOf(item), 1);
				}
			}
		);

		_this.map.on('move', update_all);
    	_this.map.on('moveend', update_all);

    	function update_all(){
			_this.onUpdate_globe(item.globe_count, item.globe);
			_this.onUpdate_pixi(item.lat, item.lng, item.pixi, item.particle_size/2.5);
		}
	},
	onUpdate_globe : function(globe_count, globe){
		var cfloor = Math.floor(globe_count);

		//point
		var va = globe.bezierPoints[cfloor];
		var vb = globe.bezierPoints[cfloor + 1];
		var vab = vb.clone().sub(va);

		vab.setLength(vab.length()*(globe_count - cfloor));

		vc = va.clone().add(vab);

		//globe.particle.position.set( vc.x, vc.y, vc.z );
		globe.loc = [vc.x, vc.y, vc.z];

		//line
		globe.line.geometry.setDrawRange( 0, cfloor + 2 );
		var pos = globe.line.geometry.attributes.position.array;
		pos[(cfloor + 2) * 3 - 3] = vc.x;
		pos[(cfloor + 2) * 3 - 2] = vc.y;
		pos[(cfloor + 2) * 3 - 1] = vc.z;

		globe.line.geometry.attributes.position.needsUpdate = true;
	},
	onUpdate_pixi : function(lng, lat, pixi, s){
		var point = [lat, lng];
		var c_pos = mapboxgl.LngLat.convert(point);
		var pos = _this.map.project(_this.map.transform.renderWorldCopies ? mapboxgl.lngLat.wrapToBestWorld(_this.map.getCenter()) : c_pos);
		pos = _this.pixi.convert_world_pos.convert(pos);
		pixi.tailSprite.x = pos.x;
		pixi.tailSprite.y = pos.y;
		pixi.headSprite.x = pos.x;
		pixi.headSprite.y = pos.y;
		pixi.headSprite.scale.x = pixi.headSprite.scale.y = s;
	},
	gen_globe_anim : function(from, to, s){
		var item = {};
		item.count = 0;
		//globe
		var loc1 = this.globe.three_2d_3d(from[0], from[1]);
		var loc2 = this.globe.three_2d_3d(to[0], to[1]);

		var cloc = this.three_center_point(loc1, loc2);

		var vc = new THREE.Vector3( );
		var vcloc = new THREE.Vector3( cloc.x, cloc.y, cloc.z );
		var vcros = vcloc.setLength(this.globe.radius*1.5 - vcloc.length());

		var bezierCurve = new THREE.CubicBezierCurve3(
			loc1,
			loc1.clone().add(vcros),
			loc2.clone().add(vcros),
			loc2
		);

		item.bezierPoints = bezierCurve.getPoints( this.line_details );

		//here
		item.line = this.create_globe_line(item.bezierPoints);
		item.particle = this.create_globe_particle(s);

		this.globe.earthMesh.add(item.line);
		this.globe.earthMesh.add(item.particle);

		return item;
	},
	three_center_point : function(l1, l2){
		var c = {};
		c.x = l1.x + (l2.x - l1.x)/2;
		c.y = l1.y + (l2.y - l1.y)/2;
		c.z = l1.z + (l2.z - l1.z)/2;

		return c;
	},
	create_globe_line : function(bezierPoints){
		//http://jsfiddle.net/L0rdzbej/276/ -- gradient color
		var MAX_POINTS = this.line_details;
		// geometry
		var geometry = new THREE.BufferGeometry();

		// attributes
		var positions = new Float32Array( MAX_POINTS * 3 ); // 3 vertices per point
		geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

		for(var i = 0; i < MAX_POINTS; i++){
			positions[i*3] = bezierPoints[i].x;
			positions[i*3 + 1] = bezierPoints[i].y;
			positions[i*3 + 2] = bezierPoints[i].z;
		}

		// draw range
		geometry.setDrawRange( 0, 0 );

		// material
		var material = new THREE.LineBasicMaterial( {
			color: 0xffffff 
		} );

		// line
		var line = new THREE.Line( geometry,  material );

		return line;
	},
	create_globe_particle : function(s){
		var material = new THREE.SpriteMaterial( {
			map: this.globe.map_mask,
			//blending: THREE.NormalBlending,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			transparent: true,
			vertexColors: true
		} );

		var particle = new THREE.Sprite( material );
		particle.scale.x = particle.scale.y = 16*s;

		return particle;
	},
	gen_pixi_anim : function(from, s){
		var item = {};
		
		item.tailSprite = new PIXI.Sprite(this.pixi.tailtexture);
		this.pixi.tailcontainer.addChild(item.tailSprite);

		item.headSprite = new PIXI.Sprite(_this.pixi.SpriteTexture);
		//item.headSprite.scale.x = 0.05*s;
		//item.headSprite.scale.y = 0.05*s;
		item.headSprite.anchor.set(0.4);
		item.headSprite.blendMode = PIXI.BLEND_MODES.ADD;

		this.pixi.worldcontainer.addChild(item.headSprite);

		item.tailSprite.x = -10;
		item.tailSprite.y = -10;

		item.headSprite.x = -10;
		item.headSprite.y = -10;

		return item;
	},
	particle_texture_canvas : function(size,r,g,b,a){
		// create canvas
		var canvas = document.createElement( 'canvas' );
		canvas.width = size;
		canvas.height = size;

		// get context
		var context = canvas.getContext( '2d' );

		// draw gradient
		context.rect( 0, 0, size, size );
		var gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
		gradient.addColorStop(0, "rgba(255,255,255," + a + ")");
		gradient.addColorStop(.2, "rgba(" + [ r, g, b, 1 ] + ")");
		gradient.addColorStop(0.4, "rgba(" + [ 0, 0, 0, 0 ] + ")");
		gradient.addColorStop(1, "rgba(" + [ 0, 0, 0, 0 ] + ")");
		context.fillStyle = gradient;
		context.fillRect(0, 0, size, size);

		// var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
		// window.location.href=image; // it will save locally

		return canvas;
	}
};

function init_stats(){
	javascript:(
		function(){
			var script=document.createElement('script');
			script.onload=function(){
				var stats=new Stats();
				document.body.appendChild(stats.dom);
				requestAnimationFrame(function loop(){
					stats.update();
					requestAnimationFrame(loop)
				});
			};
			script.src='js/stats.min.js';
			document.head.appendChild(script);
		}
	)()
}

///////////////////////////////////////////////////////////////////
//INFO COLLAPSIBLE
///////////////////////////////////////////////////////////////////
var coll = document.getElementsByClassName("collapsible");
var i;

for (i = 0; i < coll.length; i++) {
  coll[i].addEventListener("click", function() {
	this.classList.toggle("active");
	var content = this.nextElementSibling;
	if (content.style.maxHeight){
	  content.style.maxHeight = null;
	} else {
	  content.style.maxHeight = content.scrollHeight + "px";
	} 
  });
}
///////////////////////////////////////////////////////////////////
//END INFO COLLAPSIBLE
///////////////////////////////////////////////////////////////////