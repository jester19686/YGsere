import * as THREE from 'three';

// Функция создания звёздного неба
export function createStarField(): THREE.Points {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 10000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  
  for (let i = 0; i < starCount; i++) {
    // Размещаем звёзды в большой сфере вокруг сцены
    const radius = 500 + Math.random() * 500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
    
    // Разные оттенки звёзд (белые, голубые, желтоватые)
    const colorChoice = Math.random();
    if (colorChoice < 0.7) {
      // Белые звёзды
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    } else if (colorChoice < 0.85) {
      // Голубоватые
      colors[i * 3] = 0.7;
      colors[i * 3 + 1] = 0.8;
      colors[i * 3 + 2] = 1;
    } else {
      // Желтоватые
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 0.9;
      colors[i * 3 + 2] = 0.7;
    }
  }
  
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const starMaterial = new THREE.PointsMaterial({
    size: 0.7,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });
  
  return new THREE.Points(starGeometry, starMaterial);
}

// Функция создания атмосферы с glow эффектом
export function createAtmosphere(radius: number, globalUniforms: any): THREE.Mesh {
  const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.15, 64, 64);
  const atmosphereMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    uniforms: {
      time: globalUniforms.time
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        // Fresnel эффект для атмосферы
        float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        
        // Цвет атмосферы - голубоватый с зеленоватым оттенком
        vec3 atmosphere = vec3(0.2, 0.6, 0.8) * intensity;
        
        // Добавляем небольшую пульсацию
        float pulse = sin(time * 0.5) * 0.1 + 0.9;
        atmosphere *= pulse;
        
        gl_FragColor = vec4(atmosphere, intensity * 0.6);
      }
    `
  });
  
  return new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
}

// Функция добавления освещения
export function setupLighting(scene: THREE.Scene): void {
  // Ambient light - общее мягкое освещение
  const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
  scene.add(ambientLight);

  // Hemisphere light - имитирует свет неба и земли
  const hemiLight = new THREE.HemisphereLight(0x0080ff, 0x080820, 0.5);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  // Directional light - имитирует солнце
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(50, 30, 50);
  scene.add(sunLight);
}

// Улучшение настроек рендерера
export function enhanceRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
