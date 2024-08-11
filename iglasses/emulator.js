const SHADERS = {
    vs: `#version 300 es
    in vec4 position;
    in vec2 uv;
    out vec2 uvV;
    uniform mat4 projection;
    
    void main() {
      uvV = uv;
      gl_Position = projection * position;
    }`,
    fs: `#version 300 es

  
    precision mediump float;
    
    in vec2 uvV;
    
    uniform sampler2D jsdos;
    uniform int side;
    
    out vec4 fragColor;
    
    void main() {
      vec2 uv = uvV;
      
      ivec2 coords = ivec2(uv * vec2(textureSize(jsdos, 0)));
      coords.y = coords.y/2*2; // Round down to even y coordinate.
      
      coords = coords%textureSize(jsdos, 0);
      
      // 0 being bottom means 0 and all even pixel rows are the right size of the image.
      // So if we're on the left, offset by 1 to get odd pixels.
      
      
      coords.y += 1 - side;
      
    
      fragColor = texelFetch(jsdos, coords, 0);
      //fragColor = texelFetch(jsdos, ivec2(0, 0), 0);
    }`
};

const IGLASSES_FOV = {
    downDegrees: 30,
    upDegrees: 30,
    leftDegrees: 30,
    rightDegrees: 30
};
const IGLASSES_FOV_TAN = {
    down: Math.tan(IGLASSES_FOV.downDegrees * Math.PI/180)*(3/4),
    up: Math.tan(IGLASSES_FOV.upDegrees * Math.PI/180)*(3/4),
    left: Math.tan(IGLASSES_FOV.leftDegrees * Math.PI/180),
    right: Math.tan(IGLASSES_FOV.rightDegrees * Math.PI/180)
};

class VREmulator {
    constructor(options) {
        this.jsdosElement = options.jsdosElement;
        this.webglElement = options.webglElement;

        this.webglElement.addEventListener("webglcontextlost", function(event) {
            event.preventDefault();
        });

        this.webglElement.addEventListener("webglcontextrestored", () => this.init, false);
    }

    init() {
        this.gl = this.webglElement.getContext("webgl2", {xrCompatible: true});
        this.programInfo = twgl.createProgramInfo(this.gl, [SHADERS.vs, SHADERS.fs]);
        let left = IGLASSES_FOV_TAN.left;
        let right = IGLASSES_FOV_TAN.right;
        let up = IGLASSES_FOV_TAN.up;
        let down = IGLASSES_FOV_TAN.down;
    
        const arrays = {
          position: [
          -left, -down, -1,
          right, -down, -1,
          -left, up, -1,
          -left, up, -1,
          right, -down, -1,
          right, up, -1],
          uv: {numComponents: 2, data: [
            0, 0,
            1, 0,
            0, 1,
            0, 1,
            1, 0,
            1, 1
          ]}
        };
        this.bufferInfo = twgl.createBufferInfoFromArrays(this.gl, arrays);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);



        this.render();
    }

    render(time, frame) {
        if(this.gl.isContextLost()) {
            return;
        }
        let vr = this.xrSession && frame;
        let pose = null;
        if(vr) {
          pose = frame.getViewerPose(this.xrReferenceSpace);
          if(!pose) vr=false;
        }
        if(vr) {
          window.latestPose = pose; // Used by the tracker. Needs to be cleaned up
          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.xrSession.renderState.baseLayer.framebuffer);
        } else {
          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        }
        twgl.resizeCanvasToDisplaySize(this.gl.canvas);
        
        
        const jsdosTexture = twgl.createTexture(this.gl, { src: this.jsdosElement });
  
        
        
        let projection;
        if(vr) {
          let viewport = this.xrSession.renderState.baseLayer.getViewport(pose.views[0]);
          this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
          projection = pose.views[0].projectionMatrix;
        } else {
          this.gl.viewport(0, 0, this.gl.canvas.width/2, this.gl.canvas.height);
          projection = twgl.m4.identity();
        }
        const uniforms = {
          jsdos: jsdosTexture,
          side: 0,
          projection: projection
        };
  
        this.gl.useProgram(this.programInfo.program);
        twgl.setBuffersAndAttributes(this.gl, this.programInfo, this.bufferInfo);
        twgl.setUniforms(this.programInfo, uniforms);
        twgl.drawBufferInfo(this.gl, this.bufferInfo);
        
        if(vr) {
          let viewport = this.xrSession.renderState.baseLayer.getViewport(pose.views[1]);
          this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
          projection = pose.views[1].projectionMatrix;
          twgl.setUniforms(this.programInfo, {projection: projection});
        } else {
          this.gl.viewport(this.gl.canvas.width/2, 0, this.gl.canvas.width/2, this.gl.canvas.height);
        }
        twgl.setUniforms(this.programInfo, {side: 1});
        twgl.drawBufferInfo(this.gl, this.bufferInfo);
        if(this.xrSession) {
          this.xrSession.requestAnimationFrame(this.render.bind(this));
        } else {
          requestAnimationFrame(this.render.bind(this));
        }
    }
}