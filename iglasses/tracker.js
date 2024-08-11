function eulerFromQuaternion(out, q, order) {
  // From https://github.com/immersive-web/webxr-polyfill/blob/master/src/lib/OrientationArmModel.js
  function clamp(value, min$$1, max$$1) {
    return value < min$$1 ? min$$1 : value > max$$1 ? max$$1 : value;
  }
  var sqx = q[0] * q[0];
  var sqy = q[1] * q[1];
  var sqz = q[2] * q[2];
  var sqw = q[3] * q[3];
  if (order === 'XYZ') {
    out[0] = Math.atan2(2 * (q[0] * q[3] - q[1] * q[2]), sqw - sqx - sqy + sqz);
    out[1] = Math.asin(clamp(2 * (q[0] * q[2] + q[1] * q[3]), -1, 1));
    out[2] = Math.atan2(2 * (q[2] * q[3] - q[0] * q[1]), sqw + sqx - sqy - sqz);
  } else if (order === 'YXZ') {
    out[0] = Math.asin(clamp(2 * (q[0] * q[3] - q[1] * q[2]), -1, 1));
    out[1] = Math.atan2(2 * (q[0] * q[2] + q[1] * q[3]), sqw - sqx - sqy + sqz);
    out[2] = Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), sqw - sqx + sqy - sqz);
  } else if (order === 'ZXY') {
    out[0] = Math.asin(clamp(2 * (q[0] * q[3] + q[1] * q[2]), -1, 1));
    out[1] = Math.atan2(2 * (q[1] * q[3] - q[2] * q[0]), sqw - sqx - sqy + sqz);
    out[2] = Math.atan2(2 * (q[2] * q[3] - q[0] * q[1]), sqw - sqx + sqy - sqz);
  } else if (order === 'ZYX') {
    out[0] = Math.atan2(2 * (q[0] * q[3] + q[2] * q[1]), sqw - sqx - sqy + sqz);
    out[1] = Math.asin(clamp(2 * (q[1] * q[3] - q[0] * q[2]), -1, 1));
    out[2] = Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), sqw + sqx - sqy - sqz);
  } else if (order === 'YZX') {
    out[0] = Math.atan2(2 * (q[0] * q[3] - q[2] * q[1]), sqw - sqx + sqy - sqz);
    out[1] = Math.atan2(2 * (q[1] * q[3] - q[0] * q[2]), sqw + sqx - sqy - sqz);
    out[2] = Math.asin(clamp(2 * (q[0] * q[1] + q[2] * q[3]), -1, 1));
  } else if (order === 'XZY') {
    out[0] = Math.atan2(2 * (q[0] * q[3] + q[1] * q[2]), sqw - sqx + sqy - sqz);
    out[1] = Math.atan2(2 * (q[0] * q[2] + q[1] * q[3]), sqw + sqx - sqy - sqz);
    out[2] = Math.asin(clamp(2 * (q[2] * q[3] - q[0] * q[1]), -1, 1));
  } else {
    console.log('No order given for quaternion to euler conversion.');
    return;
  }
}

class Antifilter {
	constructor(len) {
		this.history = new Array(len);
		this.history.fill(1);
		this.len = len;
		this.current = 0;
		this.end = len-1;
	}
	
	filter(newval) {
  function clamp(value, min$$1, max$$1) {
    return value < min$$1 ? min$$1 : value > max$$1 ? max$$1 : value;
  }
		let current = this.current;
		let last = this.current;
		this.history[this.current] = 0; // To substitute later.
		this.current += 1;
		if(this.current == this.len) {
			this.current = 0;
		}
		let sum = 0;
		while(true) {
			sum += this.history[current];
			current -= 1;
			if(current === -1) {
				current = this.end;
			}
			if(current === last) {
				break;
			}
		}
		let replacement = clamp(this.len * newval - sum, -1.5, 1.5);
		this.history[last] = replacement;
		return replacement;
	}
}


class Tracker {
    constructor() {
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
        this.OK = this.encoder.encode("O");
        this.ERR = this.encoder.encode("E");
        this.reply = null;
        
        this.data_mode = "cooked";
        this.send_mode = "polled";
        this.send_format = "binary";
		
		this.antifilters = {
			"x": new Antifilter(3),
			"y": new Antifilter(3),
			"z": new Antifilter(3),
			"pitch": new Antifilter(6),
			"roll": new Antifilter(6)
		};
		
		this.use_antifilter = false;
    }
    
    dispatch(command) {
        if(command === "!\r") {
            return this.OK;
        } else if(command.startsWith("!M")) {
            return this.mode(command.slice(2, -1)); // Remove !M and \r
        } else if(command === "!R\r") {
            return this.mode("1,P,B");
        } else if(command === "S") {
            return this.orientation();
        } else if(command === "!V\r") {
			return this.encoder.encode("MSgeoComet0000000PWebVRWebVRWebVR0TWebVR000H000.000F000.000O");
		} else {
            console.error("Unrecognized command:", command);
            return this.ERR;
        }
    }
    
    mode(modestring) {
        let [data_mode, send_mode, send_format] = modestring.split(",");
        if(data_mode === "1") {
            this.data_mode = "cooked";
        } else if(data_mode === "2") {
            this.data_mode = "euler";
        } else {
            console.error("Unsupported data mode:", data_mode);
            return this.ERR;
        }
        if(send_mode === "P") {
            this.send_mode = "polled";
        } else {
            // TODO?: Continuous
            console.error("Unsupported send mode:", send_mode);
            return this.ERR;
        }
        if(send_format === "B") {
            this.send_format = "binary";
        } else {
            // TODO: ASCII
            console.error("Unsupported send format:", send_format);
            return this.ERR;
        }
        return this.OK;
    }
    
    orientation() {
        let pitch;
        let roll;
        let yaw;
        
        if(window.latestPose) {
            let euler = [0, 0, 0];
            let arrayOrientation = [window.latestPose.transform.orientation.x, window.latestPose.transform.orientation.y, window.latestPose.transform.orientation.z, window.latestPose.transform.orientation.w];
            eulerFromQuaternion(euler, arrayOrientation, "YXZ");
            [pitch, yaw, roll] = euler;
        } else {
            pitch = window.pitch || 0.0; // Radians
            roll = window.roll || 0.0; // Radians
            yaw = window.yaw || 0.0;
        }


        
        let antirotation = twgl.m4.identity();
        twgl.m4.rotateZ(antirotation, -roll, antirotation);
        twgl.m4.rotateX(antirotation, -pitch, antirotation);
        let [x, y, z] = twgl.m4.transformDirection(antirotation, [Math.cos(yaw), 0.0, Math.sin(yaw)]);
		
		if(this.use_antifilter) {
			x = this.antifilters.x.filter(x);
			y = this.antifilters.y.filter(y);
			z = this.antifilters.z.filter(z);
			pitch = this.antifilters.pitch.filter(pitch);
			roll = this.antifilters.roll.filter(roll);
		}
        
        let result;
        if(this.data_mode === 'cooked') {
            result = new ArrayBuffer(12);
            let view = new DataView(result);
            view.setInt8(0, 0xFF);
            view.setInt16(1, x * 16384, false);
            view.setInt16(3, y * 16384, false);
            view.setInt16(5, z * 16384, false);
            view.setInt16(7, pitch/Math.PI*16384, false);
            view.setInt16(9, roll/Math.PI*16384, false);
            let checksum = 0;
            for(let i=0; i<=10; i++) {
                checksum += view.getUint8(i);
            }
            view.setUint8(11, checksum);
        } else if(this.data_mode === 'euler') {
            result = new ArrayBuffer(8);
            let view = new DataView(result);
            view.setInt8(0, 0xFF);
            view.setInt16(1, yaw * 16384/Math.PI, false);
            view.setInt16(3, pitch * 16384/Math.PI, false);
            view.setInt16(5, roll * 16384/Math.PI, false);
            let checksum = 0;
            for(let i=0; i<=6; i++) {
                checksum += view.getUint8(i);
            }
            view.setUint8(7, checksum);
        } else {
            console.error("Unsupported data mode!", this.data_mode);
        }

        
        return new Uint8Array(result);
    }
    
    install(sockfs) {
        let tracker = this;
        sockfs.websocket_sock_ops.connect = function(...args) {

            throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);
        };
        sockfs.websocket_sock_ops.poll = function() {
            // POLLIN = 0x01
            // POLLOUT = 0x04
            if(tracker.reply) {
                return 0x05;
            } else {
                return 0x04;
            }
        };
        sockfs.websocket_sock_ops.recvmsg = function(sock, length) {
            let reply = tracker.reply.slice(0, length);
            let remainder = tracker.reply.slice(length);
            if(remainder.length !== 0) {
                tracker.reply = remainder;
            } else {
                tracker.reply = null;
            }
            return {
                buffer: reply,
                addr: "tracker.invalid",
                port: 8000
            }
        };
        sockfs.websocket_sock_ops.sendmsg = function(sock, buffer, offset, length, addr, port) {
            let incoming = buffer.slice(offset, offset+length);
            let command = tracker.decoder.decode(incoming);
			let terminator_index = null;
			for(let i = 0; i < command.length; i++) {
				let c = command[i];
				if(c === "\r" || c === "S") {
					terminator_index = i;
					break;
				}
			}
			if(terminator_index === null) {
				return 0;
			}
			// Include +1 because we consume the terminator
            tracker.reply = tracker.dispatch(command.slice(0, terminator_index+1));
            return terminator_index+1;
        };
    }
}

