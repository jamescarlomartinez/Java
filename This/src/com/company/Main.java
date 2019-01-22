package com.company;

public class Main
{

    public void hello()
    {
        System.out.println("sample one");
    }
    public void hi()
    {
        System.out.println("sample two");
    }
    public void yahoo()
    {
        System.out.println("this is about THIS");
        this.hello();
        this.hi();

    }

    public static void main(String[] args)
    {
        Main wee = new Main();
        wee.yahoo();

    }
}
