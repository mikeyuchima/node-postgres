require(__dirname + "/test-helper");

var ElasticBuffer = function(size) {
  this.size = size || 1024;
  this.buffer = new Buffer(this.size);
  this.offset = 0;
};

var p = ElasticBuffer.prototype;

p._remaining = function() {
  return this.buffer.length - this.offset;
}

p._resize = function() {
  var oldBuffer = this.buffer;
  this.buffer = Buffer(oldBuffer.length + this.size);
  oldBuffer.copy(this.buffer);
}

//resizes internal buffer if not enough size left
p._ensure = function(size) {
  if(this._remaining() < size) {
    this._resize()
  }
}

p.addInt32 = function(num) {
  this._ensure(4)
  this.buffer[this.offset++] = (num >>> 24 & 0xFF)
  this.buffer[this.offset++] = (num >>> 16 & 0xFF)
  this.buffer[this.offset++] = (num >>>  8 & 0xFF)
  this.buffer[this.offset++] = (num >>>  0 & 0xFF)
  return this;
}

p.addInt16 = function(num) {
  this._ensure(2)
  this.buffer[this.offset++] = (num >>>  8 & 0xFF)
  this.buffer[this.offset++] = (num >>>  0 & 0xFF)
  return this;
}

p.addCString = function(string) {
  var string = string || "";
  var len = Buffer.byteLength(string) + 1;
  this._ensure(len);
  this.buffer.write(string, this.offset);
  this.offset += len;
  this.buffer[this.offset] = 0; //add null terminator
  return this;  
}

p.addChar = function(char) {
  this._ensure(1);
  this.buffer.write(char, this.offset);
  this.offset++;
  return this;
}

p.join = function() {
  return this.buffer.slice(0, this.offset);
}

p.getByteLength = function() {
  return this.offset;
}

p.add = function(otherBuffer) {
  this._ensure(otherBuffer.length);
  otherBuffer.copy(this.buffer, this.offset);
  this.offset += otherBuffer.length;
  return this;
}

test('adding int32', function() {
  var testAddingInt32 = function(int, expectedBuffer) {
    test('writes ' + int, function() {
      var subject = new ElasticBuffer();
      var result = subject.addInt32(int).join();
      assert.equalBuffers(result, expectedBuffer);
    })
  }

  testAddingInt32(0, [0, 0, 0, 0]);
  testAddingInt32(1, [0, 0, 0, 1]);
  testAddingInt32(256, [0, 0, 1, 0]);
  test('writes largest int32', function() {
    //todo need to find largest int32 when I have internet access
    return false;
  })

  test('writing multiple int32s', function() {
    var subject = new ElasticBuffer();
    var result = subject.addInt32(1).addInt32(10).addInt32(0).join();
    assert.equalBuffers(result, [0, 0, 0, 1, 0, 0, 0, 0x0a, 0, 0, 0, 0]);
  })

  test('having to resize the buffer', function() {
    test('after resize correct result returned', function() {
      var subject = new ElasticBuffer(10);
      subject.addInt32(1).addInt32(1).addInt32(1)
      assert.equalBuffers(subject.join(), [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1])
    })
  })
})

test('int16', function() {
  test('writes 0', function() {
    var subject = new ElasticBuffer();
    var result = subject.addInt16(0).join();
    assert.equalBuffers(result, [0,0]);
  })

  test('writes 400', function() {
    var subject = new ElasticBuffer();
    var result = subject.addInt16(400).join();
    assert.equalBuffers(result, [1, 0x90])
  })

  test('writes many', function() {
    var subject = new ElasticBuffer();
    var result = subject.addInt16(0).addInt16(1).addInt16(2).join();
    assert.equalBuffers(result, [0, 0, 0, 1, 0, 2])
  })

  test('resizes if internal buffer fills up', function() {
    var subject = new ElasticBuffer(3);
    var result = subject.addInt16(2).addInt16(3).join();
    assert.equalBuffers(result, [0, 2, 0, 3])
  })

})

test('cString', function() {
  test('writes empty cstring', function() {
    var subject = new ElasticBuffer();
    var result = subject.addCString().join();
    assert.equalBuffers(result, [0])
  })

  test('writes non-empty cstring', function() {
    var subject = new ElasticBuffer();
    var result = subject.addCString("!!!").join();
    assert.equalBuffers(result, [33, 33, 33, 0]);
  })

  test('resizes if reached end', function() {
    var subject = new ElasticBuffer(3);
    var result = subject.addCString("!!!").join();
    assert.equalBuffers(result, [33, 33, 33, 0]);
  })
  
  test('writes multiple cstrings', function() {
    var subject = new ElasticBuffer();
    var result = subject.addCString("!").addCString("!").join();
    assert.equalBuffers(result, [33, 0, 33, 0]);
  })

})

test('writes char', function() {
  var subject = new ElasticBuffer(2);
  var result = subject.addChar('a').addChar('b').addChar('c').join();
  assert.equalBuffers(result, [0x61, 0x62, 0x63])
})

test('gets correct byte length', function() {
  var subject = new ElasticBuffer(5);
  assert.equal(subject.getByteLength(), 0)
  subject.addInt32(0)
  assert.equal(subject.getByteLength(), 4)
  subject.addCString("!")
  assert.equal(subject.getByteLength(), 6)
})

test('can add arbitrary buffer to the end', function() {
  var subject = new ElasticBuffer(4);
  subject.addCString("!!!")
  var result = subject.add(Buffer("!!!")).join();
  assert.equalBuffers(result, [33, 33, 33, 0, 33, 33, 33]);
})
