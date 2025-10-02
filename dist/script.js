// Scene, Camera, Renderer
let renderer = new THREE.WebGLRenderer();
let scene = new THREE.Scene();
let aspect = window.innerWidth / window.innerHeight;
let camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1500);
let cameraRotation = 0;
let cameraRotationSpeed = 0.001;
let cameraAutoRotation = true;
let orbitControls = new THREE.OrbitControls(camera);

// Lights - Reduced brightness for better earth detail visibility
let spotLight = new THREE.SpotLight(0xffffff, 0.7, 0, 10, 2);
let ambientLight = new THREE.AmbientLight(0x404040, 0.4); // Soft ambient light
let hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x333333, 0.25); // Sky and ground light

// Texture Loader
let textureLoader = new THREE.TextureLoader();

// Planet Proto
let planetProto = {
  sphere: function (size) {
    let sphere = new THREE.SphereGeometry(size, 32, 32);

    return sphere;
  },
  material: function (options) {
    let material = new THREE.MeshPhongMaterial();
    if (options) {
      for (var property in options) {
        material[property] = options[property];
      }
    }

    return material;
  },
  glowMaterial: function (intensity, fade, color) {
    // Custom glow shader from https://github.com/stemkoski/stemkoski.github.com/tree/master/Three.js
    let glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        'c': {
          type: 'f',
          value: intensity },

        'p': {
          type: 'f',
          value: fade },

        glowColor: {
          type: 'c',
          value: new THREE.Color(color) },

        viewVector: {
          type: 'v3',
          value: camera.position } },


      vertexShader: `
        uniform vec3 viewVector;
        uniform float c;
        uniform float p;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize( normalMatrix * normal );
          vec3 vNormel = normalize( normalMatrix * viewVector );
          intensity = pow( c - dot(vNormal, vNormel), p );
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,

      fragmentShader: `
        uniform vec3 glowColor;
        varying float intensity;
        void main() 
        {
          vec3 glow = glowColor * intensity;
          gl_FragColor = vec4( glow, 1.0 );
        }`,

      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true });


    return glowMaterial;
  },
  texture: function (material, property, uri) {
    let textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = true;
    textureLoader.load(
    uri,
    function (texture) {
      material[property] = texture;
      material.needsUpdate = true;
    });

  } };


let createPlanet = function (options) {
  // Create the planet's Surface
  let surfaceGeometry = planetProto.sphere(options.surface.size);
  let surfaceMaterial = planetProto.material(options.surface.material);
  let surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);

  // Create the planet's Atmosphere
  let atmosphereGeometry = planetProto.sphere(options.surface.size + options.atmosphere.size);
  let atmosphereMaterialDefaults = {
    side: THREE.DoubleSide,
    transparent: true };

  let atmosphereMaterialOptions = Object.assign(atmosphereMaterialDefaults, options.atmosphere.material);
  let atmosphereMaterial = planetProto.material(atmosphereMaterialOptions);
  let atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);

  // Create the planet's Atmospheric glow
  let atmosphericGlowGeometry = planetProto.sphere(options.surface.size + options.atmosphere.size + options.atmosphere.glow.size);
  let atmosphericGlowMaterial = planetProto.glowMaterial(options.atmosphere.glow.intensity, options.atmosphere.glow.fade, options.atmosphere.glow.color);
  let atmosphericGlow = new THREE.Mesh(atmosphericGlowGeometry, atmosphericGlowMaterial);

  // Nest the planet's Surface and Atmosphere into a planet object
  let planet = new THREE.Object3D();
  surface.name = 'surface';
  atmosphere.name = 'atmosphere';
  atmosphericGlow.name = 'atmosphericGlow';
  planet.add(surface);
  planet.add(atmosphere);
  planet.add(atmosphericGlow);

  // Load the Surface's textures
  for (let textureProperty in options.surface.textures) {
    planetProto.texture(
    surfaceMaterial,
    textureProperty,
    options.surface.textures[textureProperty]);

  }

  // Load the Atmosphere's texture
  for (let textureProperty in options.atmosphere.textures) {
    planetProto.texture(
    atmosphereMaterial,
    textureProperty,
    options.atmosphere.textures[textureProperty]);

  }

  return planet;
};

let earth = createPlanet({
  surface: {
    size: 0.5,
    material: {
      bumpScale: 0.12,
      specular: new THREE.Color('#555555'),
      shininess: 25 },

    textures: {
      map: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/141228/earthmap1k.jpg',
      bumpMap: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/141228/earthbump1k.jpg',
      specularMap: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/141228/earthspec1k.jpg' } },


  atmosphere: {
    size: 0.003,
    material: {
      opacity: 0.5 },

    textures: {
      map: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/141228/earthcloudmap.jpg',
      alphaMap: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/141228/earthcloudmaptrans.jpg' },

    glow: {
      size: 0.02,
      intensity: 0.3,
      fade: 10,
      color: 0x6ba3d0 } } });




// Marker Proto
let markerProto = {
  latLongToVector3: function latLongToVector3(latitude, longitude, radius, height) {
    var phi = latitude * Math.PI / 180;
    var theta = (longitude - 180) * Math.PI / 180;

    var x = -(radius + height) * Math.cos(phi) * Math.cos(theta);
    var y = (radius + height) * Math.sin(phi);
    var z = (radius + height) * Math.cos(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  },
  marker: function marker(size, color, vector3Position) {
    let markerGeometry = new THREE.SphereGeometry(size);
    let markerMaterial = new THREE.MeshLambertMaterial({
      color: color });

    let markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
    markerMesh.position.copy(vector3Position);

    return markerMesh;
  } };


// Place Marker
let placeMarker = function (object, options) {
  let position = markerProto.latLongToVector3(options.latitude, options.longitude, options.radius, options.height);
  let marker = markerProto.marker(options.size, options.color, position);
  object.add(marker);
};

// Place Marker At Address
let placeMarkerAtAddress = function (address, color) {
  let encodedLocation = address.replace(/\s/g, '+');
  let httpRequest = new XMLHttpRequest();

  httpRequest.open('GET', 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodedLocation);
  httpRequest.send(null);
  httpRequest.onreadystatechange = function () {
    if (httpRequest.readyState == 4 && httpRequest.status == 200) {
      let result = JSON.parse(httpRequest.responseText);

      if (result.results.length > 0) {
        let latitude = result.results[0].geometry.location.lat;
        let longitude = result.results[0].geometry.location.lng;

        placeMarker(earth.getObjectByName('surface'), {
          latitude: latitude,
          longitude: longitude,
          radius: 0.5,
          height: 0,
          size: 0.01,
          color: color });

      }
    }
  };
};

// Galaxy
let galaxyGeometry = new THREE.SphereGeometry(100, 32, 32);
let galaxyMaterial = new THREE.MeshBasicMaterial({
  side: THREE.BackSide });

let galaxy = new THREE.Mesh(galaxyGeometry, galaxyMaterial);

// Load Galaxy Textures
textureLoader.crossOrigin = true;
textureLoader.load(
'https://s3-us-west-2.amazonaws.com/s.cdpn.io/141228/starfield.png',
function (texture) {
  galaxyMaterial.map = texture;
  scene.add(galaxy);
});


// Scene, Camera, Renderer Configuration
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.set(1, 1, 1);
orbitControls.enabled = !cameraAutoRotation;

scene.add(camera);
scene.add(spotLight);
scene.add(ambientLight);
scene.add(hemisphereLight);
scene.add(earth);

// Light Configurations
spotLight.position.set(2, 0, 1);

// Mesh Configurations
earth.receiveShadow = true;
earth.castShadow = true;
earth.getObjectByName('surface').geometry.center();

// On window resize, adjust camera aspect ratio and renderer size
window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main render function
let render = function () {
  earth.getObjectByName('surface').rotation.y += 1 / 32 * 0.01;
  earth.getObjectByName('atmosphere').rotation.y += 1 / 16 * 0.01;
  if (cameraAutoRotation) {
    cameraRotation += cameraRotationSpeed;
    camera.position.y = 0;
    camera.position.x = 2 * Math.sin(cameraRotation);
    camera.position.z = 2 * Math.cos(cameraRotation);
    camera.lookAt(earth.position);
  }
  requestAnimationFrame(render);
  renderer.render(scene, camera);
};

render();

// ========== AI TRAVEL ASSISTANT CHATBOT ==========

let chatHistory = [];
let currentDestination = null;
let isChatOpen = false;

// Chatbot UI
let chatbotContainer = document.createElement('div');
chatbotContainer.id = 'chatbot-container';
chatbotContainer.style.cssText = `
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 420px;
  height: 0;
  background: rgba(10, 10, 10, 0.95);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: height 0.3s ease;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 212, 255, 0.2);
`;

chatbotContainer.innerHTML = `
  <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h3 style="margin: 0; font-size: 14px; font-weight: 500; letter-spacing: 1px; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">여행 매니저 Sigma</h3>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: #888; font-weight: 300;">AI 여행 전문가</p>
    </div>
    <button id="close-chat" style="background: none; border: none; color: #888; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">×</button>
  </div>
  <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;"></div>
  <div id="quick-questions" style="padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 6px; flex-wrap: wrap; display: none;">
  </div>
  <div style="padding: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
    <div style="display: flex; gap: 10px;">
      <input
        id="chat-input"
        type="text"
        placeholder="여행지, 문화, 팁 등을 물어보세요..."
        style="flex: 1; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; outline: none;"
      />
      <button
        id="send-chat"
        style="padding: 12px 20px; background: linear-gradient(135deg, #00d4ff, #0099cc); border: none; border-radius: 6px; color: white; font-weight: 500; cursor: pointer; font-size: 13px; letter-spacing: 0.5px;"
      >전송</button>
    </div>
  </div>
`;

document.body.appendChild(chatbotContainer);

// Chatbot toggle button
let chatbotToggle = document.createElement('button');
chatbotToggle.id = 'chatbot-toggle';
chatbotToggle.innerHTML = `
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
`;
chatbotToggle.style.cssText = `
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00d4ff, #0099cc);
  border: none;
  color: white;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 212, 255, 0.4);
  z-index: 1999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
`;

document.body.appendChild(chatbotToggle);

// Toggle chat
chatbotToggle.addEventListener('click', () => {
  isChatOpen = !isChatOpen;
  if (isChatOpen) {
    chatbotContainer.style.height = '600px';
    chatbotToggle.style.transform = 'scale(0)';
    chatbotToggle.style.opacity = '0';

    // Welcome message and quick questions
    if (chatHistory.length === 0) {
      addMessage('assistant', '안녕하세요! 저는 여행 매니저 Sigma입니다. 여행지, 문화, 팁, 계획 등 무엇이든 물어보세요!');
      showQuickQuestions();
    }
  } else {
    chatbotContainer.style.height = '0';
    chatbotToggle.style.transform = 'scale(1)';
    chatbotToggle.style.opacity = '1';
  }
});

document.getElementById('close-chat').addEventListener('click', () => {
  isChatOpen = false;
  chatbotContainer.style.height = '0';
  chatbotToggle.style.transform = 'scale(1)';
  chatbotToggle.style.opacity = '1';
});

// Format message with markdown-like parsing
function formatMessage(text) {
  if (!text) return '';

  let formatted = text;

  // Convert **bold** to <strong>
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #00d4ff; font-weight: 500;">$1</strong>');

  // Convert headers (## Title)
  formatted = formatted.replace(/^## (.+)$/gm, '<div style="font-size: 14px; font-weight: 500; color: #00d4ff; margin: 12px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid rgba(0,212,255,0.2);">$1</div>');

  // Convert numbered lists (1. Item)
  formatted = formatted.replace(/^(\d+)\.\s(.+)$/gm, '<div style="margin: 6px 0; padding-left: 16px;"><span style="color: #00d4ff; font-weight: 500; margin-right: 8px;">$1.</span>$2</div>');

  // Convert bullet lists (- Item or * Item)
  formatted = formatted.replace(/^[-*]\s(.+)$/gm, '<div style="margin: 6px 0; padding-left: 16px;"><span style="color: #00d4ff; margin-right: 8px;">•</span>$1</div>');

  // Convert line breaks
  formatted = formatted.replace(/\n\n/g, '<div style="height: 12px;"></div>');
  formatted = formatted.replace(/\n/g, '<br>');

  // Convert $XXX (price) to highlighted format
  formatted = formatted.replace(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g, '<span style="color: #4caf50; font-weight: 500;">$$$1</span>');

  return formatted;
}

// Add message to chat
function addMessage(role, content) {
  const messagesDiv = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');

  const isUser = role === 'user';
  const formattedContent = isUser ? content : formatMessage(content);

  messageDiv.style.cssText = `
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    align-items: ${isUser ? 'flex-end' : 'flex-start'};
  `;

  messageDiv.innerHTML = `
    <div style="
      background: ${isUser ? 'linear-gradient(135deg, #00d4ff, #0099cc)' : 'rgba(255,255,255,0.05)'};
      color: ${isUser ? '#fff' : '#ddd'};
      padding: 14px 18px;
      border-radius: 12px;
      max-width: 85%;
      font-size: 13px;
      line-height: 1.8;
      font-weight: 300;
      ${isUser ? 'border-radius: 12px 12px 4px 12px;' : 'border-radius: 12px 12px 12px 4px;'}
    ">${formattedContent}</div>
  `;

  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Get system prompt with context
function getSystemPrompt() {
  let context = `You are an expert travel assistant helping users plan their world journey. You have deep knowledge about global destinations, cultures, cuisines, and travel logistics.

Current journey includes these destinations:
${travelJourney.map((loc, i) => `${i + 1}. ${loc.title} - ${loc.description}`).join('\n')}

`;

  if (currentDestination) {
    context += `\nThe user is currently viewing: ${currentDestination.title}
Key attractions: ${currentDestination.highlights.join(', ')}
Local foods: ${currentDestination.foods.join(', ')}
Tips: ${currentDestination.tips}
`;

    if (currentDestination.budget) {
      context += `
Budget Information (USD per day):
- Backpacker: $${currentDestination.budget.daily.budget} (Accommodation: $${currentDestination.budget.accommodation.budget}, Food: $${currentDestination.budget.food.budget})
- Mid-range: $${currentDestination.budget.daily.mid} (Accommodation: $${currentDestination.budget.accommodation.mid}, Food: $${currentDestination.budget.food.mid})
- Luxury: $${currentDestination.budget.daily.luxury} (Accommodation: $${currentDestination.budget.accommodation.luxury}, Food: $${currentDestination.budget.food.luxury})
- Transport: ~$${currentDestination.budget.transport}/day
- Attractions: ~$${currentDestination.budget.attractions}/day
- Trip duration: ${currentDestination.duration} days
- Total estimated cost: $${currentDestination.budget.daily.budget * currentDestination.duration} - $${currentDestination.budget.daily.luxury * currentDestination.duration}
`;
    }
  }

  context += `\n\n## Response Format Guidelines:
You can provide detailed budget advice based on the traveler's style (backpacker/mid-range/luxury). All destinations have comprehensive budget data.

**Important formatting rules:**
1. Use ## for section titles (e.g., ## 예산 분석, ## 추천 코스)
2. Use **bold** for important terms and highlights
3. Use numbered lists (1., 2., 3.) for sequential information
4. Use bullet points (- or *) for non-sequential items
5. Add blank lines between sections for readability
6. For budget info, always include specific dollar amounts

Example format:
## 예산 분석
**백패커 스타일**: $83/일
- 숙박: $30 (게스트하우스)
- 식사: $20 (현지 식당)

**중급 여행**: $173/일
- 숙박: $90 (3성급 호텔)
- 식사: $50 (레스토랑)

Provide structured, professional, and helpful travel advice in Korean. Focus on practical information, cultural insights, insider tips, and budget recommendations with clear formatting.`;

  return context;
}

// Show quick question suggestions
function showQuickQuestions() {
  const quickQuestionsDiv = document.getElementById('quick-questions');
  const questions = [
    '방문하기 좋은 시기는?',
    '예산 추천',
    '안전 팁',
    '꼭 먹어야 할 음식'
  ];

  quickQuestionsDiv.innerHTML = questions.map(q => `
    <button class="quick-question" style="
      padding: 6px 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      color: #aaa;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-weight: 400;
    ">${q}</button>
  `).join('');

  quickQuestionsDiv.style.display = 'flex';

  // Add click handlers
  document.querySelectorAll('.quick-question').forEach(btn => {
    btn.addEventListener('click', () => {
      sendMessage(btn.textContent);
      quickQuestionsDiv.style.display = 'none';
    });
  });
}

// Send message to OpenAI
async function sendMessage(userMessage) {
  addMessage('user', userMessage);

  chatHistory.push({
    role: 'user',
    content: userMessage
  });

  // Limit chat history to last 10 messages
  if (chatHistory.length > 20) {
    chatHistory = chatHistory.slice(-20);
  }

  // Add loading indicator
  const messagesDiv = document.getElementById('chat-messages');
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading-indicator';
  loadingDiv.style.cssText = `
    margin-bottom: 16px;
    display: flex;
    align-items: flex-start;
  `;
  loadingDiv.innerHTML = `
    <div style="background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 12px 12px 12px 4px;">
      <span style="color: #888; font-size: 13px;">Thinking...</span>
    </div>
  `;
  messagesDiv.appendChild(loadingDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  try {
    // Call our serverless function instead of OpenAI directly
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: getSystemPrompt()
          },
          ...chatHistory
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const data = await response.json();

    // Remove loading indicator
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.remove();

    if (data.error) {
      addMessage('assistant', 'Sorry, there was an error processing your request. Please try again.');
      console.error('OpenAI Error:', data.error);
      return;
    }

    const assistantMessage = data.choices[0].message.content;
    chatHistory.push({
      role: 'assistant',
      content: assistantMessage
    });

    addMessage('assistant', assistantMessage);

  } catch (error) {
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.remove();
    addMessage('assistant', 'Sorry, I encountered an error. Please check your connection and try again.');
    console.error('Chat error:', error);
  }
}

// Send button handler
document.getElementById('send-chat').addEventListener('click', () => {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (message) {
    sendMessage(message);
    input.value = '';
  }
});

// Enter key handler
document.getElementById('chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const message = e.target.value.trim();
    if (message) {
      sendMessage(message);
      e.target.value = '';
    }
  }
});

// Update current destination context when showing location info
const originalShowLocationInfo = showLocationInfo;
showLocationInfo = function(location) {
  currentDestination = location;
  originalShowLocationInfo(location);
};

// ========== END AI CHATBOT ==========

// dat.gui
var gui = new dat.GUI();
var guiCamera = gui.addFolder('Camera');
var guiSurface = gui.addFolder('Surface');
var guiMarkers = guiSurface.addFolder('Markers');
var guiAtmosphere = gui.addFolder('Atmosphere');
var guiAtmosphericGlow = guiAtmosphere.addFolder('Glow');

// dat.gui controls object
var cameraControls = new function () {
  this.speed = cameraRotationSpeed;
  this.orbitControls = !cameraAutoRotation;
}();

var surfaceControls = new function () {
  this.rotation = 0;
  this.bumpScale = 0.05;
  this.shininess = 10;
}();

var markersControls = new function () {
  this.address = '';
  this.color = 0xff0000;
  this.placeMarker = function () {
    placeMarkerAtAddress(this.address, this.color);
  };
}();

var atmosphereControls = new function () {
  this.opacity = 0.8;
}();

var atmosphericGlowControls = new function () {
  this.intensity = 0.7;
  this.fade = 7;
  this.color = 0x93cfef;
}();

// dat.gui controls
guiCamera.add(cameraControls, 'speed', 0, 0.1).step(0.001).onChange(function (value) {
  cameraRotationSpeed = value;
});
guiCamera.add(cameraControls, 'orbitControls').onChange(function (value) {
  cameraAutoRotation = !value;
  orbitControls.enabled = value;
});

guiSurface.add(surfaceControls, 'rotation', 0, 6).onChange(function (value) {
  earth.getObjectByName('surface').rotation.y = value;
});
guiSurface.add(surfaceControls, 'bumpScale', 0, 1).step(0.01).onChange(function (value) {
  earth.getObjectByName('surface').material.bumpScale = value;
});
guiSurface.add(surfaceControls, 'shininess', 0, 30).onChange(function (value) {
  earth.getObjectByName('surface').material.shininess = value;
});

guiMarkers.add(markersControls, 'address');
guiMarkers.addColor(markersControls, 'color');
guiMarkers.add(markersControls, 'placeMarker');

guiAtmosphere.add(atmosphereControls, 'opacity', 0, 1).onChange(function (value) {
  earth.getObjectByName('atmosphere').material.opacity = value;
});

guiAtmosphericGlow.add(atmosphericGlowControls, 'intensity', 0, 1).onChange(function (value) {
  earth.getObjectByName('atmosphericGlow').material.uniforms['c'].value = value;
});
guiAtmosphericGlow.add(atmosphericGlowControls, 'fade', 0, 50).onChange(function (value) {
  earth.getObjectByName('atmosphericGlow').material.uniforms['p'].value = value;
});
guiAtmosphericGlow.addColor(atmosphericGlowControls, 'color').onChange(function (value) {
  earth.getObjectByName('atmosphericGlow').material.uniforms.glowColor.value.setHex(value);
});

// ========== TRAVEL JOURNEY VISUALIZATION ==========

// Enhanced world journey with 12 destinations
let travelJourney = [
  {
    city: "Seoul, South Korea",
    lat: 37.5665,
    lng: 126.9780,
    date: "2024-01-15",
    duration: 3,
    title: "서울, 대한민국",
    description: "한국의 수도이자 현대와 전통이 공존하는 역동적인 도시",
    highlights: [
      "경복궁 & 북촌한옥마을 - 조선시대로의 시간여행",
      "명동 & 홍대 - K-pop과 뷰티 쇼핑의 메카",
      "N서울타워 - 360도 파노라마 전망대",
      "한강공원 - 치맥(치킨+맥주) 문화의 성지",
      "강남 & 코엑스몰 - 현대 서울의 심장부",
      "광장시장 - 전통 길거리 음식 투어"
    ],
    foods: ["비빔밥", "삼겹살", "김치찌개", "떡볶이"],
    tips: "T-money 카드는 필수! 지하철이 가장 편리합니다. 한강 야경은 반포대교 달빛무지개 분수쇼 추천.",
    story: "600년 역사의 수도 서울은 고층 빌딩 숲 사이로 한옥마을이 숨쉬는 독특한 도시입니다. 아침엔 경복궁에서 왕조의 역사를 느끼고, 점심엔 광장시장에서 마약김밥과 빈대떡을 먹고, 저녁엔 강남 클럽에서 K-pop을 즐길 수 있죠. 특히 밤의 한강은 현지인들이 치맥을 즐기며 힐링하는 특별한 공간입니다.",
    image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400",
    budget: {
      accommodation: { budget: 30, mid: 90, luxury: 280 },
      food: { budget: 20, mid: 50, luxury: 120 },
      transport: 8,
      attractions: 25,
      daily: { budget: 83, mid: 173, luxury: 433 }
    }
  },
  {
    city: "Tokyo, Japan",
    lat: 35.6762,
    lng: 139.6503,
    date: "2024-01-20",
    duration: 4,
    title: "도쿄, 일본",
    description: "첨단 기술과 전통 문화가 완벽하게 조화를 이루는 메트로폴리스",
    highlights: [
      "아사쿠사 센소지 - 1400년 역사의 도쿄 최고 사찰",
      "시부야 스크램블 - 3000명이 동시에 건너는 교차로",
      "츠키지 외시장 - 새벽 5시 참치 경매와 오마카세",
      "하라주쿠 타케시타 거리 - 일본 스트릿 패션의 발신지",
      "신주쿠 로봇 레스토랑 - 미래형 공연 식사",
      "도쿄타워 & 스카이트리 - 도쿄의 양대 랜드마크"
    ],
    foods: ["스시 오마카세", "라멘", "규카츠", "모찌"],
    tips: "JR Pass 구매 필수. 편의점 음식도 수준급이니 꼭 시도해보세요!",
    story: "미슐랭 스타 레스토랑이 세계에서 가장 많은 도쿄. 하지만 길거리 라멘집의 한 그릇도 예술입니다. 네온사인 가득한 밤거리를 걷다 보면 갑자기 고즈넉한 신사가 나타나는 매력. 벚꽃 시즌의 우에노 공원과 메구로강은 평생 잊지 못할 장관을 선사합니다.",
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400",
    budget: {
      accommodation: { budget: 40, mid: 110, luxury: 350 },
      food: { budget: 25, mid: 60, luxury: 150 },
      transport: 12,
      attractions: 30,
      daily: { budget: 107, mid: 212, luxury: 542 }
    }
  },
  {
    city: "Bangkok, Thailand",
    lat: 13.7563,
    lng: 100.5018,
    date: "2024-01-26",
    duration: 3,
    title: "방콕, 태국",
    description: "황금 사원과 현대가 공존하는 동남아시아의 천사의 도시",
    highlights: [
      "왕궁 & 왓프라깨우 - 눈부신 황금 불탑",
      "왓아룬 새벽사원 - 차오프라야 강변의 석양",
      "카오산로드 - 백패커들의 성지",
      "짜뚜짝 위켄드 마켓 - 세계 최대 주말시장",
      "수상시장 - 배를 타고 쇼핑하는 독특한 경험",
      "루프탑 바 - 스카이 바에서 마시는 칵테일"
    ],
    foods: ["팟타이", "똠얌꿍", "망고 스티키 라이스", "쏨땀"],
    tips: "스쿰빗 지역 숙소 추천. 툭툭 가격은 꼭 흥정하세요. 4~5월은 너무 더워요!",
    story: "천사의 도시라 불리는 방콕은 아침엔 스님들의 탁발 행렬을, 밤엔 루프탑 바의 화려한 야경을 볼 수 있는 대조의 도시입니다. 왕궁의 황금빛 불탑에 감탄하다가도, 길거리 팟타이의 맛에 또 한번 감동하게 되죠. 저렴한 마사지와 친절한 미소가 가득한 이곳에서 진정한 휴식을 찾을 수 있습니다.",
    image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400",
    budget: {
      accommodation: { budget: 15, mid: 50, luxury: 180 },
      food: { budget: 10, mid: 25, luxury: 70 },
      transport: 5,
      attractions: 15,
      daily: { budget: 45, mid: 95, luxury: 270 }
    }
  },
  {
    city: "Dubai, UAE",
    lat: 25.2048,
    lng: 55.2708,
    date: "2024-02-01",
    duration: 3,
    title: "두바이, 아랍에미리트",
    description: "사막 위의 미래 도시, 럭셔리와 모험의 완벽한 조화",
    highlights: [
      "부르즈 칼리파 - 세계 최고층 빌딩 828m",
      "두바이 몰 & 분수쇼 - 세계 최대 쇼핑몰",
      "팜 주메이라 - 인공 야자수 섬",
      "사막 사파리 - 샌드보딩과 낙타 체험",
      "골드 & 스파이스 수크 - 전통 시장",
      "두바이 마리나 - 요트와 마천루의 조화"
    ],
    foods: ["샤와르마", "후무스", "쿠나파", "대추야자"],
    tips: "금요일은 주말! 여름(6~8월)은 극도로 더우니 피하세요. 복장 규정 유의.",
    story: "불과 50년 전만 해도 사막이었던 곳에 세운 미래 도시. 세계 최고층 빌딩에서 내려다보는 전망, 사막에서의 짜릿한 샌드보딩, 그리고 7성급 호텔에서의 황제 같은 하루. 전통 아랍 문화와 초현대적 건축물이 공존하는 이곳은 마치 SF 영화 속을 걷는 듯한 느낌을 줍니다.",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400",
    budget: {
      accommodation: { budget: 50, mid: 150, luxury: 500 },
      food: { budget: 20, mid: 60, luxury: 200 },
      transport: 15,
      attractions: 40,
      daily: { budget: 125, mid: 265, luxury: 755 }
    }
  },
  {
    city: "Paris, France",
    lat: 48.8566,
    lng: 2.3522,
    date: "2024-02-06",
    duration: 5,
    title: "파리, 프랑스",
    description: "세느강이 흐르는 예술과 낭만의 영원한 도시",
    highlights: [
      "에펠탑 - 매 시각 정각 5분간 반짝이는 조명쇼",
      "루브르 박물관 - 모나리자와 35,000점의 예술품",
      "개선문 & 샹젤리제 - 나폴레옹이 남긴 유산",
      "몽마르트 언덕 - 사크레쾨르 성당과 예술가의 거리",
      "베르사유 궁전 - 루이 14세의 화려한 궁전",
      "센 강 유람선 - 바토 무슈로 보는 파리의 밤"
    ],
    foods: ["크루아상", "에스카르고", "크렘 브륄레", "마카롱"],
    tips: "박물관은 매월 첫째 일요일 무료! 에펠탑은 저녁 7시 이후가 더 로맨틱해요.",
    story: "센 강변을 따라 걷다보면 왜 파리가 '사랑의 도시'인지 알게 됩니다. 카페에 앉아 크루아상을 베어물며 사람 구경하는 것만으로도 행복한 이곳. 저녁이면 에펠탑의 반짝이는 조명이 도시 전체를 마법처럼 감싸고, 몽마르트 언덕에서 바라보는 파리의 야경은 그 어떤 그림보다 아름답습니다.",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400",
    budget: {
      accommodation: { budget: 45, mid: 130, luxury: 400 },
      food: { budget: 25, mid: 65, luxury: 180 },
      transport: 10,
      attractions: 35,
      daily: { budget: 115, mid: 240, luxury: 625 }
    }
  },
  {
    city: "Rome, Italy",
    lat: 41.9028,
    lng: 12.4964,
    date: "2024-02-13",
    duration: 4,
    title: "로마, 이탈리아",
    description: "2700년 역사가 살아 숨쉬는 영원의 도시",
    highlights: [
      "콜로세움 - 고대 로마 검투사의 경기장",
      "바티칸 시티 - 미켈란젤로의 시스티나 성당",
      "트레비 분수 - 동전 던지면 다시 로마로",
      "판테온 - 2000년 전 건축기술의 정수",
      "스페인 계단 - 영화 로마의 휴일 촬영지",
      "나보나 광장 - 베르니니의 4대강 분수"
    ],
    foods: ["카르보나라", "카치오 에 페페", "젤라또", "티라미수"],
    tips: "로마패스로 대중교통+입장료 할인. 레스토랑은 관광지에서 2블록만 벗어나세요!",
    story: "모든 길은 로마로 통한다는 말처럼, 이 도시는 유럽 문명의 심장입니다. 2000년 전 검투사들이 싸웠던 콜로세움을 걷고, 미켈란젤로가 그린 천장화에 감탄하고, 트레비 분수에 동전을 던지며 재방문을 약속하죠. 거리 곳곳이 야외 박물관 같은 이곳에서는, 점심에 먹는 파스타 한 접시도 예술이 됩니다.",
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400",
    budget: {
      accommodation: { budget: 40, mid: 120, luxury: 380 },
      food: { budget: 22, mid: 55, luxury: 150 },
      transport: 8,
      attractions: 30,
      daily: { budget: 100, mid: 213, luxury: 568 }
    }
  },
  {
    city: "Barcelona, Spain",
    lat: 41.3851,
    lng: 2.1734,
    date: "2024-02-19",
    duration: 4,
    title: "바르셀로나, 스페인",
    description: "가우디의 꿈이 현실이 된 지중해의 예술 도시",
    highlights: [
      "사그라다 파밀리아 - 140년째 건축중인 성당",
      "구엘 공원 - 동화 속 모자이크 정원",
      "람블라스 거리 - 거리 예술가들의 퍼포먼스",
      "고딕 지구 - 중세 골목길 미로 탐험",
      "카사 밀라 & 카사 바트요 - 가우디의 걸작 주택",
      "보케리아 시장 - 신선한 해산물과 하몽"
    ],
    foods: ["파에야", "하몽", "츄로스", "타파스"],
    tips: "사그라다는 온라인 예매 필수! 해변은 바르셀로네타, 일몰은 몬주익 언덕에서.",
    story: "가우디라는 천재 건축가가 도시 전체를 예술 작품으로 만들어버린 바르셀로나. 사그라다 파밀리아의 경이로운 스테인드글라스, 구엘 공원의 형형색색 모자이크, 그리고 람블라스 거리의 활기찬 에너지까지. 낮에는 가우디 투어를, 밤에는 해변에서 상그리아 한 잔. 지중해의 태양이 만들어낸 완벽한 도시입니다.",
    image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400",
    budget: {
      accommodation: { budget: 35, mid: 100, luxury: 320 },
      food: { budget: 20, mid: 50, luxury: 140 },
      transport: 7,
      attractions: 28,
      daily: { budget: 90, mid: 185, luxury: 495 }
    }
  },
  {
    city: "London, UK",
    lat: 51.5074,
    lng: -0.1278,
    date: "2024-02-25",
    duration: 4,
    title: "런던, 영국",
    description: "왕실의 전통과 펑크 문화가 공존하는 세계의 금융 수도",
    highlights: [
      "빅벤 & 국회의사당 - 런던의 상징",
      "버킹엄 궁전 - 근위병 교대식",
      "대영박물관 - 로제타 스톤과 세계 문명",
      "타워 브릿지 - 템스강의 아이콘",
      "해리포터 스튜디오 - 마법 세계로의 초대",
      "코벤트 가든 - 거리 공연과 빈티지 마켓"
    ],
    foods: ["피쉬 앤 칩스", "선데이 로스트", "애프터눈 티", "잉글리시 브렉퍼스트"],
    tips: "오이스터 카드 필수! 박물관 대부분 무료입니다. 펍에서 현지인과 대화해보세요.",
    story: "빅벤의 종소리와 함께 시작되는 하루, 버킹엄 궁전의 근위병 교대식을 보고, 대영박물관에서 세계 역사를 한눈에 담고, 저녁엔 웨스트엔드 뮤지컬을 관람하죠. 전통 펍에서 마시는 기네스 한 잔, 템스강 위의 런던 아이에서 바라보는 야경. 셜록 홈즈와 해리포터의 도시는 언제나 우리를 매혹시킵니다.",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400",
    budget: {
      accommodation: { budget: 50, mid: 140, luxury: 450 },
      food: { budget: 28, mid: 70, luxury: 200 },
      transport: 12,
      attractions: 40,
      daily: { budget: 130, mid: 262, luxury: 702 }
    }
  },
  {
    city: "New York, USA",
    lat: 40.7128,
    lng: -74.0060,
    date: "2024-03-02",
    duration: 5,
    title: "뉴욕, 미국",
    description: "잠들지 않는 도시, 꿈과 기회의 땅",
    highlights: [
      "자유의 여신상 - 페리 타고 리버티 아일랜드",
      "타임스퀘어 - 세계의 교차로, 브로드웨이",
      "센트럴파크 - 도심 속 거대한 오아시스",
      "브루클린 브릿지 - 일출과 함께 걷기",
      "메트로폴리탄 미술관 - 5000년 인류 예술사",
      "엠파이어 스테이트 빌딩 - 86층 전망대"
    ],
    foods: ["뉴욕 피자", "베이글", "핫도그", "치즈케이크"],
    tips: "지하철 7일 패스 추천. 브루클린 덤보에서 보는 맨해튼 야경이 최고!",
    story: "뉴욕에 오면 모든 것이 가능해 보입니다. 24시간 활기찬 이 도시는 세계 각국의 문화가 녹아든 멜팅팟입니다. 브로드웨이 뮤지컬에서 감동받고, 메트 미술관에서 고흐를 만나고, MoMA에서 현대 예술에 빠지죠. 센트럴파크를 산책하고, 브루클린 브릿지를 걸으며, 진정한 세계의 수도를 온몸으로 느낍니다.",
    image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400",
    budget: {
      accommodation: { budget: 60, mid: 180, luxury: 550 },
      food: { budget: 35, mid: 80, luxury: 220 },
      transport: 15,
      attractions: 45,
      daily: { budget: 155, mid: 320, luxury: 830 }
    }
  },
  {
    city: "San Francisco, USA",
    lat: 37.7749,
    lng: -122.4194,
    date: "2024-03-09",
    duration: 3,
    title: "샌프란시스코, 미국",
    description: "금문교와 케이블카가 있는 실리콘밸리의 관문 도시",
    highlights: [
      "금문교 - 안개 속 붉은 다리의 장관",
      "피셔맨스 워프 - 씨라이언과 크램 차우더",
      "알카트라즈 섬 - 악명 높은 연방 교도소",
      "롬바드 거리 - 세계에서 가장 구불구불한 거리",
      "케이블카 - 언덕을 오르는 빈티지 전차",
      "차이나타운 - 아시아 밖 최대 중국인 거주지"
    ],
    foods: ["크램 차우더", "던지니스 크랩", "미션 부리또", "샌프란 사워도우"],
    tips: "안개가 많아 여름도 쌀쌀해요. 레이어드 복장 필수! 알카트라즈는 사전 예약.",
    story: "금문교의 붉은 다리가 안개 속에서 나타나는 순간, 샌프란시스코의 마법이 시작됩니다. 케이블카를 타고 가파른 언덕을 오르고, 피셔맨스 워프에서 크램 차우더를 먹고, 알카트라즈 섬에서 스릴을 느끼죠. 실리콘밸리의 혁신적인 에너지와 히피 문화의 자유로움이 공존하는 독특한 도시입니다.",
    image: "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=400",
    budget: {
      accommodation: { budget: 55, mid: 170, luxury: 520 },
      food: { budget: 30, mid: 75, luxury: 210 },
      transport: 12,
      attractions: 40,
      daily: { budget: 137, mid: 297, luxury: 782 }
    }
  },
  {
    city: "Los Angeles, USA",
    lat: 34.0522,
    lng: -118.2437,
    date: "2024-03-14",
    duration: 4,
    title: "로스앤젤레스, 미국",
    description: "할리우드 스타의 꿈이 시작되는 천사들의 도시",
    highlights: [
      "할리우드 사인 & 명예의 거리 - 스타들의 흔적",
      "산타모니카 피어 - 루트 66의 종착지",
      "그리피스 천문대 - LA 전경을 한눈에",
      "베니스 비치 - 힙스터들의 해변 문화",
      "유니버설 스튜디오 - 영화 속으로",
      "게티 센터 - 언덕 위 현대미술관"
    ],
    foods: ["인앤아웃 버거", "타코", "아사이볼", "코리안 BBQ"],
    tips: "차 필수! 교통체증 피하려면 오전 일찍 이동. 해변은 오후 4시 이후가 베스트.",
    story: "할리우드 사인 아래 펼쳐진 스타들의 도시. 명예의 거리에서 좋아하는 배우의 별을 찾고, 산타모니카 해변에서 석양을 보고, 그리피스 천문대에서 LA의 야경에 취하죠. 베니스 비치의 자유로운 예술가들, 비버리힐스의 명품 거리까지. 영화 속에서만 보던 장소들이 현실이 되는 곳입니다.",
    image: "https://images.unsplash.com/photo-1534190239940-9ba8944ea261?w=400",
    budget: {
      accommodation: { budget: 50, mid: 160, luxury: 500 },
      food: { budget: 32, mid: 75, luxury: 200 },
      transport: 20,
      attractions: 35,
      daily: { budget: 137, mid: 290, luxury: 755 }
    }
  },
  {
    city: "Sydney, Australia",
    lat: -33.8688,
    lng: 151.2093,
    date: "2024-03-20",
    duration: 4,
    title: "시드니, 호주",
    description: "푸른 바다와 현대적 건축이 어우러진 남반구의 보석",
    highlights: [
      "오페라하우스 - 20세기 건축의 걸작",
      "하버 브릿지 - 브릿지 클라임 체험",
      "본다이 비치 - 서퍼들의 천국",
      "달링 하버 - 항구의 야경과 레스토랑",
      "블루마운틴 - 유칼립투스 숲과 협곡",
      "록스 지구 - 시드니 최초의 유럽인 정착지"
    ],
    foods: ["피쉬 앤 칩스", "바라문디", "팀탐", "베지마이트"],
    tips: "오팔 카드 구매. 페리가 가장 로맨틱한 교통수단! 여름은 12~2월입니다.",
    story: "시드니 하버에 떠오르는 일출을 보며 마시는 플랫 화이트 한 잔. 이곳 사람들의 여유로운 라이프스타일이 부러워집니다. 세계에서 가장 아름다운 항구 도시답게, 어디를 가든 푸른 바다가 함께하죠. 오페라하우스의 하얀 돛처럼, 이 도시는 항상 우아하고 밝은 에너지로 가득합니다. 세계일주의 마지막을 장식하기에 완벽한 도시입니다.",
    image: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400",
    budget: {
      accommodation: { budget: 45, mid: 130, luxury: 420 },
      food: { budget: 28, mid: 65, luxury: 180 },
      transport: 10,
      attractions: 35,
      daily: { budget: 118, mid: 240, luxury: 645 }
    }
  }
];

// Create arc curve between two points on sphere
function createArcCurve(startLat, startLng, endLat, endLng, radius) {
  let start = markerProto.latLongToVector3(startLat, startLng, radius, 0);
  let end = markerProto.latLongToVector3(endLat, endLng, radius, 0);

  // Calculate mid point with height for arc effect
  let midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  let distance = start.distanceTo(end);
  let heightFactor = distance * 0.3; // Arc height based on distance
  midPoint.normalize().multiplyScalar(radius + heightFactor);

  // Create quadratic bezier curve
  let curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
  return curve;
}

// Draw travel path with animated arc
let travelPaths = [];
let travelMarkers = [];
let currentPathIndex = 0;
let animationProgress = 0;
let isAnimating = false;

function createTravelMarker(location, index) {
  let position = markerProto.latLongToVector3(location.lat, location.lng, 0.5, 0.01);

  // Create marker group
  let markerGroup = new THREE.Object3D();
  markerGroup.position.copy(position);
  markerGroup.userData = { location: location, index: index };

  // Main marker sphere
  let markerGeometry = new THREE.SphereGeometry(0.015);
  let markerMaterial = new THREE.MeshLambertMaterial({
    color: 0xff6b6b,
    emissive: 0xff0000
  });
  let marker = new THREE.Mesh(markerGeometry, markerMaterial);
  markerGroup.add(marker);

  // Outer ring
  let ringGeometry = new THREE.TorusGeometry(0.03, 0.002, 8, 24);
  let ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.6
  });
  let ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  markerGroup.add(ring);

  // Add pulsing animation data
  markerGroup.userData.pulsePhase = Math.random() * Math.PI * 2;
  markerGroup.userData.ring = ring;

  earth.add(markerGroup);
  travelMarkers.push(markerGroup);

  return markerGroup;
}

function createPathLine(startLocation, endLocation) {
  let curve = createArcCurve(startLocation.lat, startLocation.lng, endLocation.lat, endLocation.lng, 0.5);
  let points = curve.getPoints(50);

  // Create geometry manually for Three.js r73
  let geometry = new THREE.Geometry();
  for (let i = 0; i < points.length; i++) {
    geometry.vertices.push(points[i]);
  }

  let material = new THREE.LineBasicMaterial({
    color: 0x00d4ff,
    opacity: 0.6,
    transparent: true,
    linewidth: 2
  });

  let line = new THREE.Line(geometry, material);
  earth.add(line);
  travelPaths.push({ line: line, curve: curve, start: startLocation, end: endLocation });

  return line;
}

// Create animated plane following the path with trail
let travelPlane = null;
let planeTrail = [];
let maxTrailLength = 20;

function createTravelPlane() {
  // Create a group to hold all plane parts
  travelPlane = new THREE.Object3D();

  // Material definitions
  let bodyMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 90,
    specular: 0x888888
  });

  let accentMaterial = new THREE.MeshPhongMaterial({
    color: 0x1e88e5,
    shininess: 80,
    specular: 0x666666
  });

  let windowMaterial = new THREE.MeshPhongMaterial({
    color: 0x263238,
    shininess: 100,
    specular: 0x999999
  });

  let engineMaterial = new THREE.MeshPhongMaterial({
    color: 0x37474f,
    shininess: 70,
    specular: 0x555555
  });

  // Main fuselage (elongated, realistic shape)
  let fuselageGeometry = new THREE.CylinderGeometry(0.0055, 0.0045, 0.075, 16);
  let fuselage = new THREE.Mesh(fuselageGeometry, bodyMaterial);
  fuselage.rotation.x = Math.PI / 2;
  travelPlane.add(fuselage);

  // Nose cone (sleek, aerodynamic) - using CylinderGeometry for r73 compatibility
  let noseGeometry = new THREE.CylinderGeometry(0.0001, 0.0055, 0.022, 16);
  let nose = new THREE.Mesh(noseGeometry, bodyMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = 0.0485;
  travelPlane.add(nose);

  // Cockpit windows
  let cockpitGeometry = new THREE.SphereGeometry(0.004, 8, 8);
  let cockpit = new THREE.Mesh(cockpitGeometry, windowMaterial);
  cockpit.scale.set(1.2, 0.8, 1.5);
  cockpit.position.z = 0.032;
  cockpit.position.y = 0.003;
  travelPlane.add(cockpit);

  // Main wings (swept back design)
  let wingGeometry = new THREE.BoxGeometry(0.095, 0.0015, 0.028);
  let wings = new THREE.Mesh(wingGeometry, bodyMaterial);
  wings.position.z = 0.002;
  travelPlane.add(wings);

  // Wing tips (blue accent)
  let wingTipGeometry = new THREE.BoxGeometry(0.008, 0.0012, 0.006);
  let wingTipLeft = new THREE.Mesh(wingTipGeometry, accentMaterial);
  wingTipLeft.position.set(-0.0475, 0, 0.002);
  travelPlane.add(wingTipLeft);

  let wingTipRight = new THREE.Mesh(wingTipGeometry, accentMaterial);
  wingTipRight.position.set(0.0475, 0, 0.002);
  travelPlane.add(wingTipRight);

  // Engine nacelles (larger, more realistic)
  let engineGeometry = new THREE.CylinderGeometry(0.0035, 0.004, 0.018, 12);
  let engineLeft = new THREE.Mesh(engineGeometry, engineMaterial);
  engineLeft.rotation.x = Math.PI / 2;
  engineLeft.position.set(-0.028, -0.005, 0.002);
  travelPlane.add(engineLeft);

  let engineRight = new THREE.Mesh(engineGeometry, engineMaterial);
  engineRight.rotation.x = Math.PI / 2;
  engineRight.position.set(0.028, -0.005, 0.002);
  travelPlane.add(engineRight);

  // Engine intakes (dark circles at front)
  let intakeGeometry = new THREE.CylinderGeometry(0.003, 0.003, 0.001, 10);
  let intakeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

  let intakeLeft = new THREE.Mesh(intakeGeometry, intakeMaterial);
  intakeLeft.rotation.x = Math.PI / 2;
  intakeLeft.position.set(-0.028, -0.005, 0.011);
  travelPlane.add(intakeLeft);

  let intakeRight = new THREE.Mesh(intakeGeometry, intakeMaterial);
  intakeRight.rotation.x = Math.PI / 2;
  intakeRight.position.set(0.028, -0.005, 0.011);
  travelPlane.add(intakeRight);

  // Vertical tail fin (larger, more prominent)
  let tailFinGeometry = new THREE.BoxGeometry(0.001, 0.022, 0.016);
  let tailFin = new THREE.Mesh(tailFinGeometry, bodyMaterial);
  tailFin.position.set(0, 0.011, -0.03);
  travelPlane.add(tailFin);

  // Tail fin accent (blue stripe)
  let tailAccentGeometry = new THREE.BoxGeometry(0.0012, 0.022, 0.004);
  let tailAccent = new THREE.Mesh(tailAccentGeometry, accentMaterial);
  tailAccent.position.set(0, 0.011, -0.024);
  travelPlane.add(tailAccent);

  // Horizontal stabilizers
  let stabGeometry = new THREE.BoxGeometry(0.035, 0.001, 0.01);
  let stabilizer = new THREE.Mesh(stabGeometry, bodyMaterial);
  stabilizer.position.set(0, 0.011, -0.03);
  travelPlane.add(stabilizer);

  // Body stripe (blue livery)
  let stripeGeometry = new THREE.CylinderGeometry(0.0057, 0.0047, 0.05, 16);
  let stripe = new THREE.Mesh(stripeGeometry, accentMaterial);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.008;
  stripe.position.y = 0.003;
  travelPlane.add(stripe);

  // Window line (row of dark windows)
  for (let i = 0; i < 12; i++) {
    let windowGeometry = new THREE.SphereGeometry(0.0008, 6, 6);
    let window = new THREE.Mesh(windowGeometry, windowMaterial);
    window.position.set(0, 0.0055, 0.025 - i * 0.005);
    travelPlane.add(window);
  }

  travelPlane.visible = false;
  scene.add(travelPlane);
}

function createTrailParticle(position) {
  let particleGeometry = new THREE.SphereGeometry(0.006);
  let particleMaterial = new THREE.MeshBasicMaterial({
    color: 0xaaddff,
    transparent: true,
    opacity: 0.9
  });
  let particle = new THREE.Mesh(particleGeometry, particleMaterial);
  particle.position.copy(position);
  scene.add(particle);

  planeTrail.push({
    mesh: particle,
    life: 1.0
  });

  if (planeTrail.length > maxTrailLength) {
    let old = planeTrail.shift();
    scene.remove(old.mesh);
  }
}

function updateTrail() {
  planeTrail.forEach((particle, index) => {
    particle.life -= 0.05;
    particle.mesh.material.opacity = particle.life * 0.8;
    particle.mesh.scale.multiplyScalar(0.95);

    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      planeTrail.splice(index, 1);
    }
  });
}

createTravelPlane();

// Initialize travel markers and paths
travelJourney.forEach((location, index) => {
  createTravelMarker(location, index);
  if (index > 0) {
    createPathLine(travelJourney[index - 1], location);
  }
});

// Animation function with pause at destinations
let isPaused = false;
let pauseTimer = 0;
let pauseDuration = 5000; // 5 seconds pause at each destination

function animateTravelPath() {
  if (!isAnimating || currentPathIndex >= travelPaths.length) {
    travelPlane.visible = false;
    return;
  }

  // Handle pause at destination
  if (isPaused) {
    pauseTimer += 16; // ~60fps
    if (pauseTimer >= pauseDuration) {
      isPaused = false;
      pauseTimer = 0;
      animationProgress = 0;
      currentPathIndex++;

      if (currentPathIndex >= travelPaths.length) {
        isAnimating = false;
        travelPlane.visible = false;
        return;
      }
    } else {
      return; // Stay paused
    }
  }

  let path = travelPaths[currentPathIndex];
  animationProgress += animationSpeed;
  updateJourneyStats();

  if (animationProgress >= 1) {
    // Reached destination - show info and pause
    let location = travelJourney[currentPathIndex + 1];
    showLocationInfo(location);
    isPaused = true;
    travelPlane.visible = false;
    return;
  }

  // Update plane position along curve
  let point = path.curve.getPoint(animationProgress);
  let tangent = path.curve.getTangent(animationProgress);

  travelPlane.position.copy(point);
  travelPlane.visible = true;

  // Create trail particles
  if (Math.random() < 0.5) {
    createTrailParticle(point.clone());
  }

  // Orient plane in direction of travel
  let axis = new THREE.Vector3(0, 0, 1);
  travelPlane.quaternion.setFromUnitVectors(axis, tangent.normalize());

  // Add slight tilt for realistic flight
  travelPlane.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;
}

// Show location info panel
function showLocationInfo(location) {
  if (!location) return;

  let highlightsList = location.highlights ?
    location.highlights.map(h => `<li style="margin: 10px 0; font-weight: 300; color: #bbb; position: relative; padding-left: 0;"><span style="color: #00d4ff; margin-right: 8px;">·</span>${h}</li>`).join('') : '';

  let foodsList = location.foods ?
    location.foods.map(f => `<span style="display: inline-block; background: rgba(255,255,255,0.05); padding: 6px 14px; border-radius: 3px; margin: 4px 4px 4px 0; font-size: 11px; border: 1px solid rgba(255,255,255,0.1); color: #ccc; font-weight: 300;">${f}</span>`).join('') : '';

  infoPanel.innerHTML = `
    <div style="position: relative;">
      <img src="${location.image}"
           style="width: 100%; height: 240px; object-fit: cover; display: block;"
           onerror="this.src='https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=240&fit=crop'">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85));">
      </div>
      <div style="position: absolute; bottom: 20px; left: 24px; right: 24px;">
        <h2 style="margin: 0; color: #ffffff; font-weight: 300; font-size: 28px; text-shadow: 2px 2px 8px rgba(0,0,0,0.9); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; letter-spacing: 0.5px;">${location.title}</h2>
        <p style="margin: 8px 0 0 0; color: #ccc; text-shadow: 1px 1px 4px rgba(0,0,0,0.8); font-size: 13px; font-weight: 300; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">${location.description}</p>
      </div>
    </div>
    <div style="padding: 24px; max-height: 450px; overflow-y: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="background: rgba(255, 255, 255, 0.02); padding: 18px; border-radius: 4px; margin-bottom: 20px; border-left: 2px solid rgba(0, 212, 255, 0.5);">
        <p style="margin: 0; color: #888; font-size: 11px; font-weight: 400; letter-spacing: 0.5px;">${location.date} · ${location.duration || 3} DAYS</p>
        <p style="margin: 12px 0 0 0; font-size: 14px; color: #bbb; line-height: 1.7; font-weight: 300;">${location.story || location.description}</p>
      </div>
      ${highlightsList ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #ffffff; margin: 0 0 14px 0; font-size: 13px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase;">Key Attractions</h3>
          <ul style="margin: 0; padding-left: 0; color: #ccc; line-height: 1.8; font-size: 13px; list-style: none;">
            ${highlightsList}
          </ul>
        </div>
      ` : ''}
      ${foodsList ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #ffffff; margin: 0 0 12px 0; font-size: 13px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase;">Local Cuisine</h3>
          <div style="margin-top: 8px;">
            ${foodsList}
          </div>
        </div>
      ` : ''}
      ${location.tips ? `
        <div style="background: rgba(255, 255, 255, 0.03); padding: 16px; border-radius: 4px; border-left: 2px solid rgba(255, 193, 7, 0.6); margin-bottom: 20px;">
          <h3 style="color: #ffc107; margin: 0 0 10px 0; font-size: 12px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase;">Travel Tips</h3>
          <p style="margin: 0; color: #bbb; font-size: 12px; line-height: 1.7; font-weight: 300;">${location.tips}</p>
        </div>
      ` : ''}
      ${location.budget ? `
        <div style="background: rgba(76, 175, 80, 0.08); padding: 16px; border-radius: 4px; border-left: 2px solid rgba(76, 175, 80, 0.6); margin-bottom: 20px;">
          <h3 style="color: #4caf50; margin: 0 0 12px 0; font-size: 12px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase;">예산 가이드 (USD)</h3>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;">
            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 3px; text-align: center;">
              <div style="font-size: 10px; color: #888; margin-bottom: 4px;">백패커</div>
              <div style="font-size: 16px; color: #4caf50; font-weight: 500;">$${location.budget.daily.budget}</div>
              <div style="font-size: 9px; color: #666; margin-top: 2px;">/일</div>
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 3px; text-align: center; border: 1px solid rgba(76, 175, 80, 0.3);">
              <div style="font-size: 10px; color: #aaa; margin-bottom: 4px;">중급</div>
              <div style="font-size: 16px; color: #66bb6a; font-weight: 500;">$${location.budget.daily.mid}</div>
              <div style="font-size: 9px; color: #666; margin-top: 2px;">/일</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 3px; text-align: center;">
              <div style="font-size: 10px; color: #888; margin-bottom: 4px;">럭셔리</div>
              <div style="font-size: 16px; color: #81c784; font-weight: 500;">$${location.budget.daily.luxury}</div>
              <div style="font-size: 9px; color: #666; margin-top: 2px;">/일</div>
            </div>
          </div>

          <div style="font-size: 11px; color: #999; line-height: 1.6;">
            <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span>숙박</span>
              <span style="color: #aaa;">$${location.budget.accommodation.budget} - $${location.budget.accommodation.luxury}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span>식사</span>
              <span style="color: #aaa;">$${location.budget.food.budget} - $${location.budget.food.luxury}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span>교통</span>
              <span style="color: #aaa;">~$${location.budget.transport}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0;">
              <span>관광/액티비티</span>
              <span style="color: #aaa;">~$${location.budget.attractions}</span>
            </div>
          </div>

          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; color: #777; text-align: center;">
            ${location.duration}일 총 예상 경비: $${location.budget.daily.budget * location.duration} - $${location.budget.daily.luxury * location.duration}
          </div>
        </div>
      ` : ''}
      <p style="font-size: 11px; color: #666; margin: 0; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.08); font-weight: 300; letter-spacing: 0.5px;">${location.city}</p>
    </div>
    <div style="padding: 0 24px 24px 24px;">
      <button onclick="document.getElementById('info-panel').style.display='none'"
              style="width: 100%; padding: 14px; background: transparent; border: 1px solid #00d4ff; border-radius: 4px; color: #00d4ff; font-weight: 500; cursor: pointer; font-size: 12px; transition: all 0.3s; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        CONTINUE
      </button>
    </div>
  `;
  infoPanel.style.display = 'block';

  // Zoom to location (increased distance for smaller earth view)
  let targetPos = markerProto.latLongToVector3(location.lat, location.lng, 0.5, 1.3);
  cameraAutoRotation = false;
  orbitControls.enabled = true;

  let startPos = camera.position.clone();
  let startTime = Date.now();
  let duration = 1500;

  function animateCamera() {
    let elapsed = Date.now() - startTime;
    let progress = Math.min(elapsed / duration, 1);
    progress = progress * (2 - progress);

    camera.position.lerpVectors(startPos, targetPos, progress);
    camera.lookAt(earth.position);

    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    }
  }
  animateCamera();
}

// Info panel HTML with image
let infoPanel = document.createElement('div');
infoPanel.id = 'info-panel';
infoPanel.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.95);
  color: white;
  padding: 0;
  border-radius: 15px;
  max-width: 500px;
  display: none;
  z-index: 1000;
  font-family: Arial, sans-serif;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
`;
document.body.appendChild(infoPanel);

// Progress bar
let progressBar = document.createElement('div');
progressBar.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 0%;
  height: 4px;
  background: linear-gradient(90deg, #00d4ff, #0099cc, #00d4ff);
  z-index: 1001;
  transition: width 0.3s ease;
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
`;
document.body.appendChild(progressBar);

// Journey stats
let journeyStats = document.createElement('div');
journeyStats.id = 'journey-stats';
journeyStats.style.cssText = `
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 15px 20px;
  border-radius: 12px;
  z-index: 1000;
  font-family: Arial, sans-serif;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 212, 255, 0.3);
`;
journeyStats.innerHTML = `
  <div style="font-size: 10px; color: #00d4ff; font-weight: 600; letter-spacing: 2px; margin-bottom: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">GLOBAL EXPEDITION</div>
  <div id="current-route" style="font-size: 15px; margin-bottom: 6px; font-weight: 300; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Ready</div>
  <div id="journey-progress" style="font-size: 11px; color: #999; font-weight: 300; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">0 / ${travelJourney.length}</div>
`;
document.body.appendChild(journeyStats);

// Timeline control with enhanced UI
let timelineControl = document.createElement('div');
timelineControl.style.cssText = `
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 20px 30px;
  border-radius: 30px;
  z-index: 1000;
  font-family: Arial, sans-serif;
  backdrop-filter: blur(10px);
  border: 2px solid rgba(0, 212, 255, 0.3);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
`;
timelineControl.innerHTML = `
  <div style="display: flex; align-items: center; gap: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <button id="play-btn" style="padding: 10px 28px; cursor: pointer; background: linear-gradient(135deg, #00d4ff, #0099cc); border: none; border-radius: 4px; color: white; font-weight: 500; font-size: 13px; transition: all 0.3s; letter-spacing: 0.5px;">PLAY</button>
    <button id="reset-btn" style="padding: 10px 28px; cursor: pointer; background: transparent; border: 1px solid #666; border-radius: 4px; color: #ccc; font-weight: 500; font-size: 13px; transition: all 0.3s; letter-spacing: 0.5px;">RESET</button>
    <div id="speed-control" style="display: flex; align-items: center; gap: 8px; margin-left: 20px; padding-left: 20px; border-left: 1px solid #333;">
      <span style="font-size: 11px; color: #888; font-weight: 400; letter-spacing: 1px;">SPEED</span>
      <button id="speed-slow" class="speed-btn" style="padding: 6px 14px; background: rgba(255,255,255,0.05); border: 1px solid #444; border-radius: 3px; color: #888; cursor: pointer; font-size: 11px; font-weight: 400;">0.5×</button>
      <button id="speed-normal" class="speed-btn active" style="padding: 6px 14px; background: #00d4ff; border: 1px solid #00d4ff; border-radius: 3px; color: white; cursor: pointer; font-size: 11px; font-weight: 500;">1×</button>
      <button id="speed-fast" class="speed-btn" style="padding: 6px 14px; background: rgba(255,255,255,0.05); border: 1px solid #444; border-radius: 3px; color: #888; cursor: pointer; font-size: 11px; font-weight: 400;">2×</button>
    </div>
  </div>
`;
document.body.appendChild(timelineControl);

// Speed control variables
let animationSpeed = 0.002;

// Event listeners
document.getElementById('play-btn').addEventListener('click', () => {
  isAnimating = !isAnimating;
  document.getElementById('play-btn').innerHTML = isAnimating ? 'PAUSE' : 'PLAY';
  if (isAnimating && currentPathIndex >= travelPaths.length) {
    currentPathIndex = 0;
    animationProgress = 0;
  }
});

document.getElementById('reset-btn').addEventListener('click', () => {
  currentPathIndex = 0;
  animationProgress = 0;
  isAnimating = false;
  isPaused = false;
  pauseTimer = 0;
  travelPlane.visible = false;
  document.getElementById('play-btn').innerHTML = 'PLAY';
  document.getElementById('current-route').innerHTML = 'Ready';
  document.getElementById('journey-progress').innerHTML = `0 / ${travelJourney.length}`;
  progressBar.style.width = '0%';
  infoPanel.style.display = 'none';

  // Clear trail
  planeTrail.forEach(p => scene.remove(p.mesh));
  planeTrail = [];
});

// Speed control
document.getElementById('speed-slow').addEventListener('click', () => {
  animationSpeed = 0.001;
  updateSpeedButtons('slow');
});

document.getElementById('speed-normal').addEventListener('click', () => {
  animationSpeed = 0.002;
  updateSpeedButtons('normal');
});

document.getElementById('speed-fast').addEventListener('click', () => {
  animationSpeed = 0.004;
  updateSpeedButtons('fast');
});

function updateSpeedButtons(active) {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.style.background = 'rgba(255,255,255,0.1)';
    btn.style.borderColor = '#555';
    btn.style.color = '#aaa';
  });

  let activeBtn = active === 'slow' ? 'speed-slow' : active === 'normal' ? 'speed-normal' : 'speed-fast';
  let btn = document.getElementById(activeBtn);
  btn.style.background = '#00d4ff';
  btn.style.borderColor = '#00d4ff';
  btn.style.color = 'white';
}

// Update journey stats
function updateJourneyStats() {
  let progress = ((currentPathIndex + 1) / travelPaths.length) * 100;
  progressBar.style.width = progress + '%';

  if (currentPathIndex < travelPaths.length) {
    let from = travelJourney[currentPathIndex].city.split(',')[0];
    let to = travelJourney[currentPathIndex + 1].city.split(',')[0];
    document.getElementById('current-route').innerHTML = `${from} — ${to}`;
    document.getElementById('journey-progress').innerHTML = `${currentPathIndex + 1} / ${travelJourney.length}`;
  }
}

// Mouse interaction for markers
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// Click event
window.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  // Recursive true to detect child meshes
  let intersects = raycaster.intersectObjects(travelMarkers, true);

  if (intersects.length > 0) {
    // Find the parent marker group
    let clickedObject = intersects[0].object;
    let marker = clickedObject.parent && clickedObject.parent.userData.location ? clickedObject.parent : clickedObject;
    let location = marker.userData.location;

    if (location) {
      // Use the full showLocationInfo function to display all details including budget
      showLocationInfo(location);
    }
  }
});

// Hover event - change cursor when hovering over markers
window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  let intersects = raycaster.intersectObjects(travelMarkers, true);

  if (intersects.length > 0) {
    document.body.style.cursor = 'pointer';
  } else {
    document.body.style.cursor = 'default';
  }
});

// Update render function to include animations
let originalRender = render;
render = function() {
  earth.getObjectByName('surface').rotation.y += 1 / 32 * 0.01;
  earth.getObjectByName('atmosphere').rotation.y += 1 / 16 * 0.01;

  // Pulse animation for markers
  travelMarkers.forEach(marker => {
    marker.userData.pulsePhase += 0.05;
    let scale = 1 + Math.sin(marker.userData.pulsePhase) * 0.3;
    marker.scale.set(scale, scale, scale);

    // Rotate ring
    if (marker.userData.ring) {
      marker.userData.ring.rotation.z += 0.02;
    }
  });

  // Animate travel path
  animateTravelPath();

  // Update particle trail
  updateTrail();

  if (cameraAutoRotation) {
    cameraRotation += cameraRotationSpeed;
    camera.position.y = 0;
    camera.position.x = 2 * Math.sin(cameraRotation);
    camera.position.z = 2 * Math.cos(cameraRotation);
    camera.lookAt(earth.position);
  }

  requestAnimationFrame(render);
  renderer.render(scene, camera);
};

render();