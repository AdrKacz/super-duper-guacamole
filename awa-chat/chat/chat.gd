extends Control

var is_valid_ip_address : bool = false
var is_valid_port : bool = false

onready var join_ip : LineEdit = $MarginContainer/VBoxContainer/JoinContainer/IPContainer/LineEdit
onready var join_port : LineEdit = $MarginContainer/VBoxContainer/JoinContainer/PortContainer/LineEdit

onready var join_button : Button = $MarginContainer/VBoxContainer/JoinContainer/Button
onready var join_label : Label = $MarginContainer/VBoxContainer/JoinContainer/Label

onready var chat_scroll : ScrollContainer = $MarginContainer/VBoxContainer/ChatContainer/ScrollContainer
onready var chat : Label = $MarginContainer/VBoxContainer/ChatContainer/ScrollContainer/ChatContainer/Label
onready var chat_input : LineEdit = $MarginContainer/VBoxContainer/ChatContainer/InputContainer/HBoxContainer/LineEdit
onready var chat_button : Button = $MarginContainer/VBoxContainer/ChatContainer/InputContainer/HBoxContainer/Button

onready var chat_scrollbar : VScrollBar = chat_scroll.get_v_scrollbar()
onready var chat_scrollbar_max_value : int = int(chat_scrollbar.max_value)

func _ready() -> void:
# warning-ignore:return_value_discarded
	NetworkManager.connect("chat_joined", self, "_on_Chat_Joined")
# warning-ignore:return_value_discarded
	NetworkManager.connect("chat_leaved", self, "_on_Chat_Leaved")
# warning-ignore:return_value_discarded
	NetworkManager.connect("peer_connected", self, "_on_Peer_Connected")
# warning-ignore:return_value_discarded
	NetworkManager.connect("peer_disconnected", self, "_on_Peer_Disconnected")
# warning-ignore:return_value_discarded
	chat_scrollbar.connect("changed", self, "_on_Chat_Scrollbar_Changed")

func _on_IP_text_changed(new_text) -> void:
	is_valid_ip_address = new_text.is_valid_ip_address()
	validate_join_text()


func _on_Port_text_changed(new_text):
	is_valid_port = new_text.is_valid_integer()
	validate_join_text()
	
func validate_join_text() -> void:
	if is_valid_ip_address and is_valid_port:
		join_button.disabled = false
	else:
		join_button.disabled = true


func _on_Join_pressed() -> void:
	join_ip.editable = false
	join_port.editable = false
	join_button.disabled = true
	if join_button.text == "Join":
		join_button.text = "Leave"
		join_label.text = "Connecting to %s:%s..." % [join_ip.text, join_port.text]
		NetworkManager.join_chat(join_ip.text, int(join_port.text))
	elif join_button.text == "Leave":
		join_button.text = "Join"
		join_label.text = "Disconnecting..."
		NetworkManager.leave_chat()

func _on_Input_pressed() -> void:
	for p in NetworkManager.peers:
		rpc_id(p, "add_chat_message", chat_input.text)
	add_chat_message(chat_input.text)
	chat_input.text = ""

func _on_Chat_Scrollbar_Changed() -> void:
	var max_value_int : int = int(chat_scrollbar.max_value)
	if chat_scrollbar_max_value != max_value_int:
		chat_scroll.scroll_vertical = max_value_int
		chat_scrollbar_max_value = max_value_int
	
remote func add_chat_message(message : String) -> void:
	var local_peer_id : int = get_tree().get_rpc_sender_id()
	chat.text += "\n[%010d] > %s" % [local_peer_id, message]
	
func _on_Chat_Joined() -> void:
	join_label.text = "Connected to %s:%s" % [join_ip.text, join_port.text]
	join_button.disabled = false
	chat_button.disabled = false
	
func _on_Chat_Leaved() -> void:
	join_label.text = "You're not connected"
	join_ip.editable = true
	join_port.editable = true
	join_button.disabled = false
	chat_button.disabled = true

func _on_Peer_Connected(id : int) -> void:
	chat.text += "\n[%010d] enters the chat" % id
	
func _on_Peer_Disconnected(id : int) -> void:
	chat.text += "\n[%010d] leaves the chat" % id
