extends Node

signal chat_joined
signal chat_leaved
signal peer_connected(id)
signal peer_disconnected(id)

var peer : NetworkedMultiplayerENet = NetworkedMultiplayerENet.new()
var peers : PoolIntArray = PoolIntArray()

func _ready() -> void:
	get_tree().connect("network_peer_connected", self, "_on_Network_Peer_Connected")
	get_tree().connect("network_peer_disconnected", self, "_on_Network_Peer_Disconnected")
	
	if "--server" in OS.get_cmdline_args() or OS.has_feature("Server"):
		var err : int = peer.create_server(8080, 4)
		if err == OK:
			get_tree().network_peer = peer
			print("Chat created at port 8080 for maximum 4 players.")
		else:
			print("Error while creating chat: %d" % err)

func _exit_tree() -> void:
	leave_chat()
	print("Connection closed")
	
func leave_chat() -> void:
	get_tree().network_peer = null
	emit_signal("chat_leaved")
	
func join_chat(ip_address : String, port : int) -> void:
	peer.create_client(ip_address, port)
	get_tree().network_peer = peer
	
func _on_Network_Peer_Connected(id : int) -> void:
	print("[on_Network_Peer_Connected] <%d> " % id)
	emit_signal("peer_connected", id)
	if id == 1:
		emit_signal("chat_joined")
	else:
		peers.append(id)

func _on_Network_Peer_Disconnected(id : int) -> void:
	print("[_on_Network_Peer_Disconnected] <%d> " % id)
	emit_signal("peer_disconnected", id)
	if id == 1:
		leave_chat()
	else:
		var i : int = 0
		for j in peers.size():
			i = j
			if peers[i] == id:
				break
		peers.remove(i)
	
