
import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FileText, Send, FileIcon, ArrowLeft, Clock, Hash } from 'lucide-react'

interface FileData {
  name: string
  size: number
  type: string
  lastModified: number
}

interface PdfData {
  id: string
  name: string
  date: string
}

interface PDFSummary {
  filename: string
  summary: string
  titles: string[]
}

interface AnalysisData {
  analysis_id: string
  total_documents: number
  results: PDFSummary[]
  processing_time: number
}

export default function ChatPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string }>>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarTab, setSidebarTab] = useState("sources")
  const [files, setFiles] = useState<FileData[]>([])
  const [selectedPdf, setSelectedPdf] = useState<PdfData | null>(null)
  const [chatSource, setChatSource] = useState<"upload" | "existing">("upload")
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)

  // Load data from localStorage on component mount
  useEffect(() => {
    const uploadedFiles = localStorage.getItem("uploadedFiles")
    const selectedPdfData = localStorage.getItem("selectedPdf")
    const source = localStorage.getItem("chatSource")
    const analysis = localStorage.getItem("analysisData")

    if (source) {
      setChatSource(source as "upload" | "existing")
    }

    if (uploadedFiles) {
      setFiles(JSON.parse(uploadedFiles))
    }

    if (selectedPdfData) {
      setSelectedPdf(JSON.parse(selectedPdfData))
    }

    if (analysis) {
      setAnalysisData(JSON.parse(analysis))
    }
  }, [])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // Handle chat submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    // Add user message to chat
    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // Simulate API call
      setTimeout(() => {
        // Add AI response
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `I've analyzed your ${
            chatSource === "upload" ? `${files.length} uploaded PDF(s)` : `document "${selectedPdf?.name}"`
          }. Here's what I found:\n\nThe documents contain information about financial performance, market trends, and strategic initiatives. Based on my analysis, the key points are:\n\n1. Revenue growth of 12% year-over-year\n2. Expansion into 3 new markets\n3. Cost reduction initiatives saving $2.4M annually\n\nIs there anything specific you'd like to know about these documents?`,
        }
        setMessages((prev) => [...prev, aiMessage])
        setIsLoading(false)
      }, 2000)
    } catch (error) {
      console.error("Error sending message:", error)
      setIsLoading(false)
    }
  }

  // Handle suggested prompt click
  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
  }

  // Navigate back to home
  const goBack = () => {
    // Clear localStorage
    localStorage.removeItem("uploadedFiles")
    localStorage.removeItem("selectedPdf")
    localStorage.removeItem("chatSource")
    localStorage.removeItem("analysisData")
    navigate("/")
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Chat Header */}
      <div className="border-b border-gray-200 p-4 flex justify-between items-center bg-white">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4 p-2 hover:bg-gray-100 rounded-md transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h3 className="font-medium text-lg text-purple-700">Persona.ai</h3>
          <span className="ml-4 text-sm text-gray-500">
            {chatSource === "upload"
              ? `Chatting with ${files.length} uploaded PDF${files.length > 1 ? "s" : ""}`
              : `Chatting with "${selectedPdf?.name}"`}
          </span>
        </div>
        {analysisData && (
          <div className="flex items-center text-sm text-gray-500">
            <Hash className="h-4 w-4 mr-1" />
            <span className="mr-3">{analysisData.analysis_id.slice(0, 8)}</span>
            <Clock className="h-4 w-4 mr-1" />
            <span>{analysisData.processing_time}s</span>
          </div>
        )}
      </div>

      {/* Chat Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Messages */}
          <div className="flex-1 overflow-auto p-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <FileText className="h-16 w-16 text-gray-300 mb-4" />
                <h4 className="text-xl font-medium text-gray-700 mb-2">Ask questions about your PDFs</h4>
                <p className="text-gray-500 max-w-md">
                  The AI will analyze the content and provide answers based on the information in your documents.
                </p>
                {analysisData && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-medium">✓ Semantic layer created successfully!</p>
                    <p className="text-green-600 text-sm mt-1">
                      Processed {analysisData.total_documents} documents in {analysisData.processing_time} seconds
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg ${
                      message.role === "user"
                        ? "bg-purple-50 border border-purple-100"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <p className="text-sm font-medium mb-1">{message.role === "user" ? "You" : "AI Assistant"}</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))}
                {isLoading && (
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-sm font-medium mb-1">AI Assistant</p>
                    <div className="flex space-x-2 items-center">
                      <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce"></div>
                      <div
                        className="w-2 h-2 rounded-full bg-purple-600 animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 rounded-full bg-purple-600 animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Enter a prompt, or press '/' for multiple prompts..."
                className="flex-1 border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={isLoading}
                className={`bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-md transition-colors ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 73px)' }}>
          {/* Workspace Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center">
              <FileIcon className="h-5 w-5 text-purple-600 mr-2" />
              <h3 className="font-medium">PDF Workspace</h3>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="border-b border-gray-200 flex-shrink-0">
              <div className="flex">
                <button
                  onClick={() => setSidebarTab("sources")}
                  className={`px-4 py-2 text-sm font-medium ${
                    sidebarTab === "sources"
                      ? "border-b-2 border-purple-600 text-purple-700"
                      : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
                  }`}
                >
                  Sources
                </button>
                <button
                  onClick={() => setSidebarTab("documents")}
                  className={`px-4 py-2 text-sm font-medium ${
                    sidebarTab === "documents"
                      ? "border-b-2 border-purple-600 text-purple-700"
                      : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
                  }`}
                >
                  Documents
                </button>
                <button
                  onClick={() => setSidebarTab("prompts")}
                  className={`px-4 py-2 text-sm font-medium ${
                    sidebarTab === "prompts"
                      ? "border-b-2 border-purple-600 text-purple-700"
                      : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
                  }`}
                >
                  Prompts
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* Sources Tab */}
              {sidebarTab === "sources" && (
                <div className="h-full flex flex-col">
                  {analysisData ? (
                    <>
                      <div className="text-sm text-gray-500 p-4 pb-2 flex-shrink-0 border-b border-gray-100">
                        Analysis Results ({analysisData.total_documents} documents)
                      </div>
                      <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                        <div className="space-y-4 pt-4">
                          {analysisData.results.map((result, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                              {/* Document Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <FileText className="h-4 w-4 text-purple-600 mr-2" />
                                  <span className="font-medium text-sm text-gray-800">{result.filename}</span>
                                </div>
                              </div>

                              {/* Summary */}
                              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                <h4 className="text-xs font-medium text-blue-800 mb-1">SUMMARY</h4>
                                <p className="text-sm text-blue-700">{result.summary}</p>
                              </div>

                              {/* Titles */}
                              {result.titles.length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                                  <h4 className="text-xs font-medium text-gray-800 mb-2">
                                    EXTRACTED TITLES ({result.titles.length})
                                  </h4>
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {result.titles.map((title, titleIndex) => (
                                      <div
                                        key={titleIndex}
                                        className="text-xs text-gray-600 py-1 px-2 bg-white rounded border"
                                      >
                                        {title}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No analysis data available</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {sidebarTab === "documents" && (
                <div className="p-4 h-full overflow-y-auto">
                  <div className="text-sm text-gray-500 mb-4">
                    Active Documents ({chatSource === "upload" ? files.length : selectedPdf ? 1 : 0})
                  </div>

                  {chatSource === "upload" ? (
                    files.length > 0 ? (
                      <ul className="space-y-2">
                        {files.map((file, index) => (
                          <li
                            key={`${file.name}-${index}`}
                            className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <FileText className="h-4 w-4 text-purple-600 mr-2 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center text-gray-400 py-8">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No documents found</p>
                      </div>
                    )
                  ) : selectedPdf ? (
                    <div className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <FileText className="h-4 w-4 text-purple-600 mr-2 flex-shrink-0" />
                      <div>
                        <span className="text-sm text-gray-700 block">{selectedPdf.name}</span>
                        <span className="text-xs text-gray-500">{selectedPdf.date}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-8">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No documents found</p>
                    </div>
                  )}
                </div>
              )}

              {/* Prompts Tab */}
              {sidebarTab === "prompts" && (
                <div className="p-4 h-full overflow-y-auto">
                  <div className="text-sm text-gray-500 mb-4">Suggested Prompts</div>

                  <div className="space-y-2">
                    {[
                      "Summarize the key points from all documents",
                      "Compare and contrast the main arguments",
                      "Extract all numerical data and statistics",
                      "Find contradictions between documents",
                      "What are the main topics covered?",
                      "List all the important dates mentioned",
                    ].map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestedPrompt(prompt)}
                        className="w-full text-left py-2 px-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-sm"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}